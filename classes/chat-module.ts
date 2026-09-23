import { SupiError } from "supi-core";

import type * as z from "zod";
import type { Channel } from "./channel.js";
import type { User } from "./user.js";
import type { Platform } from "../platforms/template.js";
import type { TwitchPlatform } from "../platforms/twitch.js";
import type { DiscordPlatform } from "../platforms/discord.js";
import type { CytubePlatform } from "../platforms/cytube.js";
import type { IrcPlatform } from "../platforms/irc.js";
import type { TwitchMessageData } from "../platforms/twitch-utils.js";

interface EventBase<E extends string, P extends Platform = Platform> {
	event: E;
	channel: Channel;
	platform: P;
}
type MessageEvent<P extends Platform = Platform> = EventBase<"message", P> & {
	message: string;
	user: User | null;
	raw?: never;
};
type SubscriptionEvent<P extends Platform = Platform> = EventBase<"subscription", P> & {
	message: string;
	user: string;
	data: {
		amount: number;
		months: number;
		streak: number;
		gifted: boolean;
		recipient: string;
		plan: string;
	};
};
type RaidEvent<P extends Platform = Platform> = EventBase<"raid", P> & {
	username: string;
	data: { viewers: number; };
};
type OnlineEvent<P extends Platform = Platform> = EventBase<"online", P>;
type OfflineEvent<P extends Platform = Platform> = EventBase<"offline", P>;
type TwitchMessageEvent = MessageEvent<TwitchPlatform> & {
	data: {
		customRewardId: string | null
	};
};
type TwitchRawMessageEvent = EventBase<"message", TwitchPlatform> & {
	message: string;
	user: null;
	messageData: TwitchMessageData;
	raw: {
		user: string;
		userId: string;
	};
};

type ConfigSchema = z.ZodType;
type StateFactory = () => object;
type ConfigFor<C extends ConfigSchema | undefined> = C extends ConfigSchema
	? z.output<C>
	: undefined;
type StateFor<F extends StateFactory | undefined> = F extends StateFactory
	? ReturnType<F>
	: undefined;

type ChatModuleRuntimeData<C = unknown, S extends object | undefined = object | undefined> = {
	readonly config: C;
	readonly state: S;
};
type ChatModuleRuntime<C extends ConfigSchema | undefined, F extends StateFactory | undefined> = ChatModuleRuntimeData<ConfigFor<C>, StateFor<F>>;

type PlatformEventMap = {
	twitch: {
		message: TwitchMessageEvent | TwitchRawMessageEvent;
		online: OnlineEvent<TwitchPlatform>;
		offline: OfflineEvent<TwitchPlatform>;
		raid: RaidEvent<TwitchPlatform>;
		subscription: SubscriptionEvent<TwitchPlatform>;
	};
	discord: { message: MessageEvent<DiscordPlatform>; };
	cytube: { message: MessageEvent<CytubePlatform>; };
	irc: { message: MessageEvent<IrcPlatform>; };
};
type KnownPlatformName = keyof PlatformEventMap;
type PlatformSelector = "all" | readonly KnownPlatformName[];
type EventNameForPlatforms<P extends KnownPlatformName> = { [K in P]: keyof PlatformEventMap[K]; }[P];

type ContextForPlatforms<P extends KnownPlatformName, E extends PropertyKey> = {
	[K in P]: E extends keyof PlatformEventMap[K]
		? PlatformEventMap[K][E]
		: never;
}[P];
type EventNameFor<P extends PlatformSelector> = P extends "all"
	? EventNameForPlatforms<KnownPlatformName>
	: P extends readonly KnownPlatformName[]
		? EventNameForPlatforms<P[number]>
		: never;
type ContextFor<P extends PlatformSelector, E extends PropertyKey> = P extends "all"
	? ContextForPlatforms<KnownPlatformName, E>
	: P extends readonly KnownPlatformName[]
		? ContextForPlatforms<P[number], E>
		: never;

type EventName = EventNameFor<"all">;
type AnyChatEvent = { [E in EventName]: ContextFor<"all", E>; }[EventName];
type ChatModuleHandler<
	P extends PlatformSelector,
	E extends EventNameFor<P>,
	C extends ConfigSchema | undefined,
	F extends StateFactory | undefined
> = (context: ContextFor<P, E>, runtime: ChatModuleRuntime<C, F>) => void | Promise<void>;

export type AttachmentTarget =
	| { scope: "global"; }
	| { scope: "platform"; platform: Platform["ID"]; }
	| { scope: "channel"; channel: Channel["ID"]; };
export type ChatModuleDefinition<
	P extends PlatformSelector = PlatformSelector,
	C extends ConfigSchema | undefined = undefined,
	F extends StateFactory | undefined = undefined
> = {
	name: string;
	description: string | null;
	scope: "channel" | "platform" | "global";
	platform: P,
	config?: C,
	state?: F,
	initialize? (target: AttachmentTarget, runtime: ChatModuleRuntime<C, F>): boolean | Promise<boolean>;
	handlers: {
		[E in EventNameFor<P>]?: ChatModuleHandler<P, E, C, F>;
	};
};

export type ChatModuleRuntimeFor<D> = D extends ChatModuleDefinition<
	// type parameter is not used - but is correctly inferred here as generic and ignored so the type matches
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	infer _P extends PlatformSelector,
	infer C extends ConfigSchema | undefined,
	infer F extends StateFactory | undefined
> ? ChatModuleRuntime<C, F> : never;

export interface ChatModuleRuntimeMap {
	[name: string]: ChatModuleRuntimeData;
}

export function defineChatModule <
	const P extends PlatformSelector = PlatformSelector,
	C extends ConfigSchema | undefined = undefined,
	F extends StateFactory | undefined = undefined
> (definition: ChatModuleDefinition<P, C, F>): ChatModuleDefinition<P, C, F> {
	return definition;
}

type InitializeData = {
	channel: Channel["ID"];
	chatModule: string;
	args: string | null;
};
export type GenericChatModuleDefinition = Omit<
	ChatModuleDefinition<PlatformSelector, ConfigSchema | undefined, StateFactory | undefined>,
	"initialize" | "handlers"
> & {
	initialize? (target: AttachmentTarget, runtime: ChatModuleRuntimeData): boolean | Promise<boolean>;
	handlers: Partial<Record<EventName, unknown>>;
};

type RuntimeData = {
	config: unknown;
	state: object | undefined;
};
type RuntimeAttachment = {
	definition: GenericChatModuleDefinition;
	target: AttachmentTarget;
	runtime: RuntimeData;
	enabled: boolean;
};

export class ChatModuleManager {
	private initialized = false;
	private definitions = new Map<string, GenericChatModuleDefinition>();
	private attachments = {
		global: new Map<string, RuntimeAttachment>(),
		platform: new Map<Platform["ID"], Map<string, RuntimeAttachment>>(),
		channel: new Map<Channel["ID"], Map<string, RuntimeAttachment>>()
	};

	async initialize (): Promise<void> {
		if (this.initialized) {
			throw new SupiError({ message: "Chat module manager already initialized" });
		}

		if (this.definitions.size === 0) {
			console.warn("No chat module definitions configured - no attachments will be loaded");
			this.initialized = true;
			return;
		}

		const names = [...this.definitions.keys()];
		const attachmentData = await core.Query.getRecordset<InitializeData[]>(rs => rs
			.select("Channel AS channel", "Chat_Module AS chatModule", "Specific_Arguments AS args")
			.from("chat_data", "Channel_Chat_Module")
			.where("Chat_Module IN %s+", names)
		);

		for (const { channel, chatModule, args } of attachmentData) {
			const definition = this.definitions.get(chatModule);
			if (!definition) {
				continue; // should never happen due to WHERE condition above
			}

			if (definition.scope !== "channel") {
				throw new SupiError({
					message: `Chat module "${chatModule}" is ${definition.scope}-scoped but has a channel attachment`,
					args: { chatModule, channel }
				});
			}

			const channelData = sb.Channel.get(channel);
			if (!channelData) {
				console.warn("Invalid channel found in chat module attachment", { channel, chatModule });
				continue;
			}
			else if (!ChatModuleManager.supportsPlatform(definition, channelData.Platform)) {
				throw new SupiError({
					message: `Chat module "${chatModule}" does not support the channel's platform`,
					args: {
						chatModule,
						channel,
						platform: channelData.Platform.name
					}
				});
			}

			this.attach(definition, { scope: "channel", channel }, args);
		}

		for (const attachment of this.getAllAttachments()) {
			const { definition, target, runtime } = attachment;
			attachment.enabled = (definition.initialize)
				? await definition.initialize(target, runtime)
				: true;
		}

		this.initialized = true;
	}

	get (name: string): GenericChatModuleDefinition | null {
		return this.definitions.get(name) ?? null;
	}

	getAsserted (name: string): GenericChatModuleDefinition {
		const definition = this.definitions.get(name);
		if (!definition) {
			throw new SupiError({
				message: `Assert error: asserted chat module definition "${name}" is not available`
			});
		}

		return definition;
	}

	import (definitions: readonly GenericChatModuleDefinition[]): void {
		if (this.initialized) {
			throw new SupiError({ message: "Cannot import new definitions after initialization" });
		}

		for (const definition of definitions) {
			if (this.definitions.has(definition.name)) {
				throw new SupiError({ message: `Chat module ${definition.name} is already imported` });
			}

			this.definitions.set(definition.name, definition);

			if (definition.scope === "global") {
				this.attach(definition, { scope: "global" }, null);
			}
			else if (definition.scope === "platform") {
				if (definition.platform === "all" || definition.platform.length === 0) {
					throw new SupiError({
						message: `Platform-scoped module "${definition.name}" must declare at least one platform`
					});
				}

				for (const platformName of definition.platform) {
					const platformData = sb.Platform.getAsserted(platformName);
					this.attach(definition, { scope: "platform", platform: platformData.ID }, null);
				}
			}
		}
	}

	dispatch (eventData: AnyChatEvent): void {
		if (!this.initialized) {
			throw new SupiError({ message: "Cannot dispatch chat module events before initialization" });
		}

		const { channel, platform } = eventData;
		const maps = [
			this.attachments.global,
			this.attachments.platform.get(platform.ID),
			this.attachments.channel.get(channel.ID)
		];

		for (const map of maps) {
			if (!map) {
				continue;
			}

			for (const attachment of map.values()) {
				if (!ChatModuleManager.supportsPlatform(attachment.definition, platform)) {
					continue;
				}

				ChatModuleManager.executeAttachment(attachment, eventData);
			}
		}
	}

	async reloadChannelAttachments (channelData: Channel): Promise<void> {
		const attachmentData = await core.Query.getRecordset<InitializeData[]>(rs => rs
			.select("Channel AS channel", "Chat_Module AS chatModule", "Specific_Arguments AS args")
			.from("chat_data", "Channel_Chat_Module")
			.where("Channel = %n", channelData.ID)
		);

		// Technically unsafe - ideally we want to construct the attachments first, and only then with no error,
		// go ahead and bind them to the given channel. This is simpler, but perhaps insecure.
		this.attachments.channel.get(channelData.ID)?.clear();

		for (const { chatModule, args } of attachmentData) {
			const definition = this.definitions.get(chatModule);
			if (!definition) {
				continue;
			}
			if (definition.scope !== "channel") {
				continue;
			}

			this.attach(definition, { scope: "channel", channel: channelData.ID }, args);
		}
	}

	getRuntimeData <N extends string> (name: N, target: AttachmentTarget): ChatModuleRuntimeMap[N] | null {
		if (!this.initialized) {
			throw new SupiError({ message: "Cannot get module runtime data before initialization" });
		}

		let attachment;
		if (target.scope === "global") {
			attachment = this.attachments.global.get(name);
		}
		else if (target.scope === "platform") {
			attachment = this.attachments.platform.get(target.platform)?.get(name);
		}
		else {
			attachment = this.attachments.channel.get(target.channel)?.get(name);
		}

		return (attachment?.runtime ?? null) as ChatModuleRuntimeMap[N] | null;
	}

	private attach (definition: GenericChatModuleDefinition, target: AttachmentTarget, rawArgs: string | null): void {
		if (definition.scope !== target.scope) {
			throw new SupiError({
				message: `Cannot attach ${definition.scope}-scoped module "${definition.name}" to ${target.scope}`
			});
		}

		const attachment: RuntimeAttachment = {
			definition,
			target,
			enabled: false, // create attachments as disabled first, then enable conditionally later (initialize)
			runtime: {
				config: ChatModuleManager.parseConfig(definition, target, rawArgs),
				state: definition.state?.()
			}
		};

		if (target.scope === "global") {
			this.attachments.global.set(definition.name, attachment);
		}
		else if (target.scope === "channel") {
			let modules = this.attachments.channel.get(target.channel);
			if (!modules) {
				modules = new Map();
				this.attachments.channel.set(target.channel, modules);
			}

			modules.set(definition.name, attachment);
		}
		else {
			let modules = this.attachments.platform.get(target.platform);
			if (!modules) {
				modules = new Map();
				this.attachments.platform.set(target.platform, modules);
			}

			modules.set(definition.name, attachment);
		}
	}

	private *getAllAttachments (): Iterable<RuntimeAttachment> {
		yield* this.attachments.global.values();

		for (const attachments of this.attachments.platform.values()) {
			yield* attachments.values();
		}

		for (const attachments of this.attachments.channel.values()) {
			yield* attachments.values();
		}
	}

	private static parseConfig (definition: GenericChatModuleDefinition, target: AttachmentTarget, rawArgs: string | null): unknown {
		if (!definition.config) {
			if (rawArgs !== null) {
				throw new SupiError({
					message: `Chat module "${definition.name}" has config arguments but no config schema`,
					args: { chatModule: definition.name, scope: target.scope }
				});
			}

			return;
		}

		let config: unknown;
		if (rawArgs === null) {
			config = undefined;
		}
		else {
			try {
				config = JSON.parse(rawArgs);
			}
			catch (e) {
				if (!(e instanceof Error)) {
					throw e;
				}

				throw new SupiError({
					message: `Chat module "${definition.name}" has invalid JSON config`,
					args: { chatModule: definition.name, scope: target.scope },
					cause: e
				});
			}
		}

		const result = definition.config.safeParse(config);
		if (!result.success) {
			throw new SupiError({
				message: `Chat module "${definition.name}" has invalid config: ${result.error.message}`,
				args: { chatModule: definition.name, scope: target.scope }
			});
		}

		return result.data;
	}

	private static executeAttachment (attachment: RuntimeAttachment, eventData: AnyChatEvent): void {
		if (!attachment.enabled) {
			return;
		}

		type AnyHandler = (context: AnyChatEvent, runtime: RuntimeData) => void | Promise<void>;
		const handler = attachment.definition.handlers[eventData.event] as AnyHandler | undefined;
		if (!handler) {
			return;
		}

		void handler(eventData, attachment.runtime);
	}

	private static supportsPlatform (definition: GenericChatModuleDefinition, platform: Platform): boolean {
		return (definition.platform === "all" || definition.platform.includes(platform.name as KnownPlatformName));
	}
}
