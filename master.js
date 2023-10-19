// Classes requires
const Platform = require("./classes/platform.js");
const Filter = require("./classes/filter.js");
const Command = require("./classes/command.js");
const User = require("./classes/user.js");
const AwayFromKeyboard = require("./classes/afk.js");
const Banphrase = require("./classes/banphrase.js");
const Channel = require("./classes/channel.js");
const Reminder = require("./classes/reminder.js");
const ChatModule = require("./classes/chat-module.js");

// Singletons requires
const Logger = require("./singletons/logger.js");
const Pastebin = require("./singletons/pastebin.js");
const Sandbox = require("./singletons/sandbox.js");
const VLCConnector = require("./singletons/vlc-connector.js");

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
		console.log(`Module ${path} is disabled - will not load`);
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
	try {
		config = require("./config-default.json");
	}
	catch {
		throw new Error("No default or custom configuration found");
	}
}

const databaseModuleInitializeOrder = [
	// First batch - no dependencies
	[Platform, Filter, Command, User, AwayFromKeyboard, Banphrase],
	// Second batch - all depend on Platform
	[Channel, Reminder],
	// Third batch - depends on Platform and Channel
	[ChatModule]
];

(async function () {
	"use strict";

	// Database access keys are loaded here, and stored to process.env
	require("./db-access.js");

	// The global bot namespace is initialized and assigned to global.sb upon requiring the globals module
	const initializeSbObject = require("supi-core");
	globalThis.sb = await initializeSbObject();

	// Initialize bot-specific modules with database-driven data
	for (let i = 0; i < databaseModuleInitializeOrder.length; i++) {
		const initOrder = databaseModuleInitializeOrder[i];

		const label = `Batch #${i + 1}: ${initOrder.map(i => i.name).join(", ")}`;
		console.time(label);

		const promises = initOrder.map(async (module) => await module.initialize());
		await Promise.all(promises);

		console.timeEnd(label);
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
		Pastebin: new Pastebin(),
		Sandbox: new Sandbox(),
		VLCConnector: new VLCConnector(),

		API: require("./api")
	};

	if (!config.modules.commands.disableAll) {
		const { blacklist, whitelist } = config.modules.commands;
		const { loadCommands } = await require("./commands/index.js");
		const commands = await loadCommands({ blacklist, whitelist });

		await Command.importData(commands.definitions);
	}

	await Promise.all([
		importFileDataModule(ChatModule, "chat-modules"),
		importFileDataModule(sb.Got, "gots")
	]);

	const { initializeCrons } = await import("./crons/index.mjs");
	initializeCrons(config.modules.crons);

	const controllers = {};
	const initialPlatforms = Channel.getActivePlatforms();

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

	for (const platformData of initialPlatforms) {
		let Controller = null;
		try {
			Controller = require(`./controllers/${platformData.Name}`);
		}
		catch (e) {
			console.error(`Require of ${platformData.Name} controller module failed`, e);
			continue;
		}

		const options = { host: platformData.Host };
		try {
			controllers[platformData.Name] = new Controller(options);
		}
		catch (e) {
			console.error(`Initialization of ${platformData.Name} controller module failed`, e);
			continue;
		}

		console.debug(`Platform ${platformData.Name} loaded successfully.`);
	}

	Platform.assignControllers(controllers);

	process.on("unhandledRejection", async (reason) => {
		if (!(reason instanceof Error)) {
			return;
		}

		try {
			await sb.Logger.logError("Backend", reason, {
				origin: "Internal",
				context: {
					cause: "UnhandledPromiseRejection"
				}
			});
		}
		catch {
			console.warn("Rejected the promise of promise rejection handler", { reason });
		}
	});
})();
