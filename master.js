// Classes imports
import Filter from "./classes/filter.js";
import Command from "./classes/command.js";
import User from "./classes/user.js";
import AwayFromKeyboard from "./classes/afk.js";
import Banphrase from "./classes/banphrase.js";
import Channel from "./classes/channel.js";
import Reminder from "./classes/reminder.js";
import ChatModule from "./classes/chat-module.js";

// Singletons imports
import Logger from "./singletons/logger.js";
import VLCConnector from "./singletons/vlc-connector.js";

// Platform template import
import Platform from "./platforms/template.js";

import initializeInternalApi from "./api/index.js";

const importFileDataModule = async (module, path) => {
	if (!config.modules[path]) {
		throw new Error(`Missing configuration for ${path}`);
	}

	const {
		disableAll = true,
		whitelist = [],
		blacklist = []
	} = config.modules[path];

	if (whitelist.length > 0 && blacklist.length > 0) {
		throw new Error(`Cannot combine blacklist and whitelist for ${path}`);
	}
	else if (disableAll) {
		console.warn(`Module ${path} is disabled - will not load`);
		return;
	}

	const identifier = (path === "gots") ? "name" : "Name";
	const { definitions } = await import(`./${path}/index.mjs`);
	if (blacklist.length > 0) {
		await module.importData(definitions.filter(i => !blacklist.includes(i[identifier])));
	}
	else if (whitelist.length > 0) {
		await module.importData(definitions.filter(i => whitelist.includes(i[identifier])));
	}
	else {
		await module.importData(definitions);
	}
};

let config;
try {
	config = require("./config.json");
}
catch {
	throw new Error("No custom configuration found! Copy `config-default.json` as `config.json` and set up your configuration");
}

const databaseModuleInitializeOrder = [
	// First batch - no dependencies
	[Filter, Command, User, AwayFromKeyboard, Banphrase, Channel, Reminder],
	// Second batch - depends on Channel
	[ChatModule]
];

const initializeCommands = async (config) => {
	if (config.modules.commands.disableAll) {
		console.warn("Load commands - skipped due to `disableAll` setting");
		return;
	}

	console.time("Load commands");
	const {
		blacklist,
		whitelist
	} = config.modules.commands;

	const { loadCommands } = await require("./commands/index.js");
	const commands = await loadCommands({
		blacklist,
		whitelist
	});

	await Command.importData(commands.definitions);
	console.timeEnd("Load commands");
};

// @todo remove when properly refactored to ESM
// eslint-disable-next-line unicorn/prefer-top-level-await
(async () => {
	const platformsConfig = config.platforms;
	if (!platformsConfig || platformsConfig.length === 0) {
		throw new sb.Error({
			message: "No platforms configured! Supibot will now exit."
		});
	}

	console.groupCollapsed("Initialize timers");
	console.time("supi-core");

	const core = await import("supi-core");
	const Query = new core.Query({
		user: process.env.MARIA_USER,
		password: process.env.MARIA_PASSWORD,
		host: process.env.MARIA_HOST,
		connectionLimit: process.env.MARIA_CONNECTION_LIMIT
	});

	globalThis.sb = {
		Date: core.Date,
		Error: core.Error,
		Promise: core.Promise,
		Got: core.Got,

		Query,
		Cache: new core.Cache(process.env.REDIS_CONFIGURATION),
		Metrics: new core.Metrics(),
		Utils: new core.Utils()
	};

	console.timeEnd("supi-core");

	const platforms = new Set();
	for (const definition of platformsConfig) {
		const platform = await Platform.create(definition.type, definition);
		if (platform) {
			platforms.add(platform);
		}
	}

	console.time("basic bot modules");

	// Initialize bot-specific modules with database-driven data
	for (let i = 0; i < databaseModuleInitializeOrder.length; i++) {
		console.debug(`Modules batch #${i + 1}`);

		const initOrder = databaseModuleInitializeOrder[i];
		const promises = initOrder.map(async (module) => {
			console.time(`Init ${module.name}`);
			await module.initialize();
			console.timeEnd(`Init ${module.name}`);
		});

		if (i === 0) {
			await Promise.all([...promises, initializeCommands(config)]);
		}
		else {
			await Promise.all(promises);
		}
	}

	globalThis.sb = {
		...sb,

		Platform,

		Filter,
		Command,
		User,
		AwayFromKeyboard,
		Banphrase,
		Channel,
		Reminder,
		ChatModule,

		Logger: new Logger(),
		VideoLANConnector: VLCConnector.initialize(), // @todo move code from `initialize` here

		API: initializeInternalApi()
	};

	console.timeEnd("basic bot modules");
	console.time("chat modules");

	await Promise.all([
		importFileDataModule(ChatModule, "chat-modules"), importFileDataModule(sb.Got, "gots")
	]);

	console.timeEnd("chat modules");
	console.time("crons");

	const { initializeCrons } = await import("./crons/index.mjs");
	initializeCrons(config.modules.crons);

	console.timeEnd("crons");

	if (sb.Metrics) {
		sb.Metrics.registerCounter({
			name: "supibot_messages_sent_total",
			help: "Total number of Twitch messages sent by the bot.",
			labelNames: ["platform", "channel"]
		});

		sb.Metrics.registerCounter({
			name: "supibot_messages_read_total",
			help: "Total number of Twitch messages seen (read) by the bot.",
			labelNames: ["platform", "channel"]
		});
	}

	const promises = [];
	for (const platform of platforms) {
		if (!platform.active) {
			console.debug(`Platform ${platform.name} (ID ${platform.ID}) is set to inactive, not connecting`);
			continue;
		}

		platform.checkConfig();
		promises.push((async () => {
			console.time(`Platform connect: ${platform.name}`);
			await platform.connect();
			console.timeEnd(`Platform connect: ${platform.name}`);
		})());
	}

	if (promises.length === 0) {
		console.warn("No platforms were successfully activated, bot will not connect to any chat service");
	}

	await Promise.all(promises);

	console.debug("Ready!");
	console.groupEnd();

	process.on("unhandledRejection", async (reason) => {
		if (!(reason instanceof Error)) {
			return;
		}

		const origin = (reason.message?.includes("RequestError: Timeout awaiting 'request'"))
			? "External"
			: "Internal";

		try {
			await sb.Logger.logError("Backend", reason, {
				origin,
				context: {
					cause: "UnhandledPromiseRejection"
				}
			});
		}
		catch (e) {
			console.warn("Rejected the promise of promise rejection handler", { reason, e });
		}
	});
})();
