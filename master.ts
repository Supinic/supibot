import * as supiCore from "supi-core";
import type { GotInstanceDefinition } from "supi-core";
import { getConfig } from "./config.js";
import initializeInternalApi from "./api/index.js";

import commandDefinitions from "./commands/index.js";
import chatModuleDefinitions from "./chat-modules/index.js";
import { definitions as gotDefinitions } from "./gots/index.js";
import initializeCrons from "./crons/index.js";

import { AwayFromKeyboard } from "./classes/afk.js";
import { Banphrase } from "./classes/banphrase.js";
import { Channel } from "./classes/channel.js";
import { ChatModule, type ChatModuleDefinition } from "./classes/chat-module.js";
import { Command, type CommandDefinition } from "./classes/command.js";
import { Filter } from "./classes/filter.js";
import { MpvClient as MpvClientConstructor } from "./singletons/mpv-client.js";
import { Reminder } from "./classes/reminder.js";
import { User } from "./classes/user.js";
import { logger } from "./singletons/logger.js";
import { Platform } from "./platforms/template.js";

type PopulateOptions = {
	blacklist?: string[];
	whitelist?: string[];
	disableAll?: boolean;
};

interface GlobalSb {
	API: ReturnType<typeof initializeInternalApi>;
	AwayFromKeyboard: typeof AwayFromKeyboard;
	Banphrase: typeof Banphrase;
	Channel: typeof Channel;
	ChatModule: typeof ChatModule;
	Command: typeof Command;
	Filter: typeof Filter;
	Logger: typeof logger;
	Platform: typeof Platform;
	Reminder: typeof Reminder;
	User: typeof User;
	MpvClient: MpvClientConstructor | null;
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

function filterModuleDefinitions <T extends "name" | "Name", U extends { [K in T]: string; }> (
	property: T,
	definitions: U[],
	config: PopulateOptions
): U[] {
	const {
		disableAll = true,
		whitelist = [],
		blacklist = []
	} = config;

	if (whitelist.length > 0 && blacklist.length > 0) {
		throw new Error(`Cannot combine blacklist and whitelist`);
	}
	else if (disableAll) {
		return [];
	}
	else if (whitelist.length === 0 && blacklist.length === 0) {
		return definitions;
	}

	return (blacklist.length > 0)
		? definitions.filter(i => !blacklist.includes(i[property]))
		: definitions.filter(i => whitelist.includes(i[property]));
}

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

const config = getConfig();
const platformsConfig = config.platforms;
if (platformsConfig.length === 0) {
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

console.timeEnd("supi-core");

const platforms: Set<Platform> = new Set();
for (const definition of platformsConfig) {
	const platform = await Platform.create(definition.type, definition);
	platforms.add(platform);
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

// Initialize the mpv client if configured
let MpvClient;
const { listenerAddress, listenerPort } = config.local ?? {};
if (listenerAddress) {
	MpvClient = new MpvClientConstructor({
		host: listenerAddress,
		port: listenerPort ?? 8080
	});
}
else {
	console.debug("Missing MPV configuration (listenerAddress), module creation skipped");
	MpvClient = null;
}

globalThis.sb = {
	Platform,
	Filter,
	Command,
	User,
	AwayFromKeyboard,
	Banphrase,
	Channel,
	Reminder,
	ChatModule,
	Logger: logger,
	MpvClient,
	API: initializeInternalApi()
};

console.timeEnd("basic bot modules");
console.time("chat modules");

void logger.start();
supiCore.Got.importData(filterModuleDefinitions("name", gotDefinitions as GotInstanceDefinition[], config.modules.gots));
Command.importData(filterModuleDefinitions("Name", commandDefinitions as CommandDefinition[], config.modules.commands));
await ChatModule.importData(filterModuleDefinitions("Name", chatModuleDefinitions as ChatModuleDefinition[], config.modules["chat-modules"]));

console.timeEnd("chat modules");

core.Metrics.registerCounter({
	name: "supibot_messages_sent_total",
	help: "Total number of Twitch messages sent by the bot.",
	labelNames: ["platform", "channel"]
});

core.Metrics.registerCounter({
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

	const promise = connectToPlatform(platform);
	promises.push(promise);
}

if (promises.length === 0) {
	console.warn("No platforms were successfully activated, bot will not connect to any chat service");
}

await Promise.all(promises);

console.time("crons");
initializeCrons(config.modules.crons);
console.timeEnd("crons");

console.debug("Connected to all platforms. Ready!");
console.groupEnd();

process.on("unhandledRejection", (reason) => {
	if (!(reason instanceof Error)) {
		return;
	}

	const origin = (reason.message.includes("RequestError: Timeout awaiting 'request'"))
		? "External"
		: "Internal";

	void sb.Logger.logError("Backend", reason, {
		origin,
		context: {
			cause: "UnhandledPromiseRejection"
		}
	});
});
