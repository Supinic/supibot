import { SupiError } from "supi-core";
import type { Channel } from "./channel.js";
import type { User } from "./user.js";
import type { Platform } from "../platforms/template.js";
import type { TwitchPlatform } from "../platforms/twitch.js";
import type { MessageNotification as TwitchMessageNotification } from "../platforms/twitch-utils.js";
import type { DiscordPlatform } from "../platforms/discord.js";
import type { CytubePlatform } from "../platforms/cytube.js";
import type { IrcPlatform } from "../platforms/irc.js";

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
	user: User;
	data: {
		amount: number;
		months: number;
		streak: number;
		gifted: boolean;
		recipient: User;
		plan: string;
	};
};
type RaidEvent<P extends Platform = Platform> = EventBase<"raid", P> & {
	username: string;
	data: { viewers: number; };
};
type OnlineEvent<P extends Platform = Platform> = EventBase<"online", P>;
type OfflineEvent<P extends Platform = Platform> = EventBase<"offline", P>;
type TwitchRawMessageEvent = EventBase<"message", TwitchPlatform> & {
	message: string;
	user: null;
	messageData: TwitchMessageNotification["payload"]["event"]["message"];
	raw: {
		user: string;
		userId: string;
	};
};

type PlatformEventMap = {
	twitch: {
		message: MessageEvent<TwitchPlatform> | TwitchRawMessageEvent;
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

type EventNameForPlatforms<P extends KnownPlatformName> = { [K in P]: keyof PlatformEventMap[K]; }[P];

type PlatformSelector = "all" | readonly KnownPlatformName[];
type AttachmentScope = "channel" | "platform" | "global";

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

type AnyChatEvent = { [E in EventName]: ContextFor<"all", E>; }[EventName];
type EventName = EventNameFor<"all">;
type ChatModuleHandler<P extends PlatformSelector, E extends EventNameFor<P>> = (context: ContextFor<P, E>) => void | Promise<void>;

export type ChatModuleDefinition<P extends PlatformSelector = PlatformSelector> = {
	name: string;
	description: string | null;
	scope: AttachmentScope;
	platform: P,
	handlers: {
		[E in EventNameFor<P>]?: ChatModuleHandler<P, E>;
	};
};

export function defineChatModule <
	const P extends PlatformSelector = PlatformSelector
> (definition: ChatModuleDefinition<P>): ChatModuleDefinition<P> {
	return definition;
}

type InitializeData = {
	channel: Channel["ID"];
	chatModule: string;
	args: string | null;
};
type AttachmentTarget =
	| { scope: "global"; }
	| { scope: "platform"; platform: Platform["ID"]; }
	| { scope: "channel"; channel: Channel["ID"]; };
type RuntimeAttachment = {
	definition: ChatModuleDefinition;
	target: AttachmentTarget;
	rawArgs: string | null;
	// @todo 5: uncomment and implement
	// config: unknown;
	// state: unknown;
};
type Attachments = {
	global: Map<string, RuntimeAttachment>;
	platform: Map<Platform["ID"], Map<string, RuntimeAttachment>>;
	channel: Map<Channel["ID"], Map<string, RuntimeAttachment>>;
};

export class ChatModuleManager {
	private initialized = false;
	private definitions = new Map<ChatModuleDefinition["name"], ChatModuleDefinition>();
	private attachments: Attachments = {
		global: new Map(),
		platform: new Map(),
		channel: new Map()
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
			.select("Channel AS channel", "Chat_Module as chatModule", "Specific_Arguments as args")
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

		this.initialized = true;
	}

	get (name: ChatModuleDefinition["name"]): ChatModuleDefinition | null {
		return this.definitions.get(name) ?? null;
	}

	import (definitions: ChatModuleDefinition[]): void {
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
		}
	}

	dispatch (eventData: AnyChatEvent): void {
		const { event, channel, platform } = eventData;
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

	private attach (definition: ChatModuleDefinition, target: AttachmentTarget, rawArgs: string | null): void {
		if (definition.scope !== target.scope) {
			throw new SupiError({
				message: `Cannot attach ${definition.scope}-scoped module "${definition.name}" to ${target.scope}`
			});
		}

		const attachment: RuntimeAttachment = { definition, target, rawArgs };
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
			// platform DB attachments later - will likely need DB table change (currently enforces module + channel)
			throw new SupiError({ message: "Platform attachments not implemented yet" });
		}
	}

	private static executeAttachment (attachment: RuntimeAttachment, eventData: AnyChatEvent): void {
		type AnyHandler = ChatModuleHandler<PlatformSelector, EventNameFor<PlatformSelector>>;
		const handler = attachment.definition.handlers[eventData.event] as AnyHandler | undefined;
		if (!handler) {
			return;
		}

		void handler(eventData);
	}

	private static supportsPlatform (definition: ChatModuleDefinition, platform: Platform): boolean {
		return (definition.platform === "all" || definition.platform.includes(platform.name as KnownPlatformName));
	}
}
