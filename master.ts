import * as supiCore from "supi-core";

import config from "./config.json" with { type: "json" };
import initializeInternalApi from "./api/index.js";

import commandDefinitions from "./commands/index.js";
import chatModuleDefinitions from "./chat-modules/index.js";
import gotDefinitions from "./gots/index.js";
import initializeCrons from "./crons/index.js";

import Filter from "./classes/filter.js";
import { Command } from "./classes/command.js";
import User from "./classes/user.js";
import AwayFromKeyboard from "./classes/afk.js";
import Banphrase from "./classes/banphrase.js";
import Channel from "./classes/channel.js";
import Reminder from "./classes/reminder.js";
import ChatModule from "./classes/chat-module.js";
import VLCSingleton from "./singletons/vlc-connector.js";

import Logger from "./singletons/logger.js";
import VLCConnector from "./singletons/vlc-connector.js";
import { Platform } from "./platforms/template.js";

type PopulateOptions = {
	blacklist?: string[];
	whitelist?: string[];
	disableAll?: boolean;
};
interface IdentifiableModule {
	name: string;
	Name: string;
}
interface ImportableModule<T> {
	name: string;
	importData: (definitions: T[]) => Promise<void>;
}

interface GlobalSb {
	Date: typeof supiCore.SupiDate;
	Error: typeof supiCore.SupiError;
	Promise: typeof supiCore.SupiPromise;
	Got: typeof supiCore.Got;

	Metrics: supiCore.Metrics;
	Cache: supiCore.Cache;
	Query: supiCore.Query;
	Utils: supiCore.Utils;

	API: ReturnType<typeof initializeInternalApi>;
	AwayFromKeyboard: typeof AwayFromKeyboard;
	Banphrase: typeof Banphrase;
	Channel: typeof Channel;
	ChatModule: typeof ChatModule;
	Command: typeof Command;
	Filter: typeof Filter;
	Logger: Logger;
	Platform: typeof Platform;
	Reminder: typeof Reminder;
	User: typeof User;
	VideoLANConnector: typeof VLCSingleton;
}
interface GlobalCore {
	Got: typeof supiCore.Got;
	Metrics: supiCore.Metrics;
	Cache: supiCore.Cache;
	Query: supiCore.Query;
	Utils: supiCore.Utils;
}

declare global {
	var sb: GlobalSb;
	var core: GlobalCore;
}

const populateModuleDefinitions = async <T> (definitions: T[], config: PopulateOptions) => {
	const {
		disableAll = true,
		whitelist = [],
		blacklist = []
	} = config;

	if (whitelist.length > 0 && blacklist.length > 0) {
		throw new Error(`Cannot combine blacklist and whitelist for ${module.name}`);
	}
	else if (disableAll) {
		console.warn(`Module ${module.name} is disabled - will not load`);
		return;
	}

	const identifier = (module === supiCore.Got) ? "name" : "Name";
	let definitionsToLoad = definitions;
	if (blacklist.length > 0) {
		definitionsToLoad = definitions.filter(i => !blacklist.includes(i[identifier]));
	}
	else if (whitelist.length > 0) {
		definitionsToLoad = definitions.filter(i => whitelist.includes(i[identifier]));
	}

	return definitionsToLoad;
};

const connectToPlatform = async (platform: Platform) => {
	console.time(`Platform connect: ${platform.name}`);
	await platform.connect();
	console.timeEnd(`Platform connect: ${platform.name}`);
};

const MODULE_INITIALIZE_ORDER = [
	// First batch - no dependencies
	[Filter, Command, User, AwayFromKeyboard, Banphrase, Channel, Reminder],
	// Second batch - depends on Channel
	[ChatModule]
] as const;

const platformsConfig = config.platforms;
if (!platformsConfig || platformsConfig.length === 0) {
	throw new Error("No platforms configured! Supibot will now exit.");
}

console.groupCollapsed("Initialize timers");
console.time("supi-core");

if (!process.env.MARIA_USER || !process.env.MARIA_PASSWORD || !process.env.MARIA_HOST) {
	throw new Error("Missing database connection configuration");
}
if (!process.env.REDIS_CONFIGURATION) {
	throw new Error("Missing Redis connection configuration");
}

globalThis.core = {
	Got: supiCore.Got,
	Metrics: new supiCore.Metrics(),
	Cache: new supiCore.Cache(process.env.REDIS_CONFIGURATION),
	Query: new supiCore.Query({
		user: process.env.MARIA_USER,
		password: process.env.MARIA_PASSWORD,
		host: process.env.MARIA_HOST,
		connectionLimit: (process.env.MARIA_CONNECTION_LIMIT) ? Number(process.env.MARIA_CONNECTION_LIMIT) : null
	}),
	Utils: new supiCore.Utils()
};
/** @ts-ignore Assignment is partial due to legacy globals split */
globalThis.sb = {
	Date: supiCore.Date,
	Error: supiCore.Error,
	Promise: supiCore.Promise,
	Got: supiCore.Got,

	get Query () { return core.Query; },
	get Cache () { return core.Cache; },
	get Metrics () { return core.Metrics; },
	get Utils () { return core.Utils; }
};

console.timeEnd("supi-core");

const platforms: Set<Platform> = new Set();
for (const definition of platformsConfig) {
	const platform = await Platform.create(definition.type, definition);
	if (platform) {
		platforms.add(platform);
	}
}

console.time("basic bot modules");

// Initialize bot-specific modules with database-driven data
for (let i = 0; i < MODULE_INITIALIZE_ORDER.length; i++) {
	console.debug(`Modules batch #${i + 1}`);

	const initOrder = MODULE_INITIALIZE_ORDER[i];
	const promises = initOrder.map(async (module) => {
		console.time(`Init ${module.name}`);
		await module.initialize();
		console.timeEnd(`Init ${module.name}`);
	});

	await Promise.all(promises);
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
	populateModuleDefinitions(Command, commandDefinitions, config.modules.commands),
	populateModuleDefinitions(ChatModule, chatModuleDefinitions, config.modules["chat-modules"]),
	populateModuleDefinitions(supiCore.Got, gotDefinitions, config.modules.gots)
]);

console.timeEnd("chat modules");

console.time("crons");
initializeCrons(config.modules.crons);
console.timeEnd("crons");

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

const promises = [];
for (const platform of platforms) {
	if (!platform.active) {
		console.debug(`Platform ${platform.name} (ID ${platform.ID}) is set to inactive, not connecting`);
		continue;
	}

	// eslint-disable-next-line unicorn/prefer-top-level-await
	const promise = connectToPlatform(platform);
	promises.push(promise);
}

if (promises.length === 0) {
	console.warn("No platforms were successfully activated, bot will not connect to any chat service");
}

await Promise.all(promises);

console.debug("Connected to all platforms. Ready!");
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
