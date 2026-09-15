import type { Channel } from "./channel.js";
import type { User } from "./user.js";
import type { Platform } from "../platforms/template.js";
import type { SimpleGenericData } from "../utils/globals.js";
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

type EventMap = {
	message: MessageEvent;
	online: OnlineEvent;
	offline: OfflineEvent;
	raid: RaidEvent;
	subscription: SubscriptionEvent;
};
type EventName = keyof EventMap;
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

export function defineChatModule<P extends PlatformSelector = PlatformSelector> (definition: ChatModuleDefinition<P>): ChatModuleDefinition<P> {
	return definition;
}

export type Event = "message" | "online" | "offline" | "raid" | "subscription";
export type EventArgument = SimpleGenericData;

type AttachmentTarget =
	| { scope: "global"; }
	| { scope: "platform"; platform: Platform; }
	| { scope: "channel"; channel: Channel; };
type RuntimeAttachment = {
	definition: ChatModuleDefinition;
	target: AttachmentTarget;
	config: unknown;
	state: unknown;
};
type Attachments = {
	global: Map<string, RuntimeAttachment>;
	platform: Map<Platform["ID"], Map<string, RuntimeAttachment>>;
	channel: Map<Channel["ID"], Map<string, RuntimeAttachment>>;
};

export class ChatModuleManager {
	private definitions = new Map<ChatModuleDefinition["name"], ChatModuleDefinition>();
	private attachments: Attachments = {
		global: new Map(),
		platform: new Map(),
		channel: new Map()
	};

	async initialize (): Promise<void> {
		if (this.definitions.size === 0) {
			console.warn("No chat module definitions configured, will not load any attachments");
			return;
		}

		const names = [...this.definitions.keys()];
		const data = await core.Query.getRecordset<Channel["ID"][]>(rs => rs
			.select("Channel", "Chat_Module", "Specific_Arguments")
			.from("chat_data", "Channel_Chat_Module")
			.where("Chat_Module IN %s+", names)
		);
	}

	get (name: ChatModuleDefinition["name"]): ChatModuleDefinition | null {
		return this.definitions.get(name) ?? null;
	}

	import (definitions: ChatModuleDefinition[]): void {
		for (const definition of definitions) {
			this.definitions.set(definition.name, definition);

			if (definition.scope === "global") {
				this.attachments.global.set(definition.name, {
					definition,
					target: { scope: "global" }
				});
			}
		}
	}

	dispatch<E extends EventName> (eventData: ContextFor<PlatformSelector, E>): void {
		const { channel, platform } = eventData;
		const platformAttachments = this.attachments.platform.get(platform.ID) ?? [];
		const channelAttachments = this.attachments.channel.get(channel.ID) ?? [];
		const list = new Set<ChatModuleDefinition["name"]>(
			...this.attachments.global,
			...platformAttachments,
			...channelAttachments
		);

		for (const name of list) {
			const module = this.definitions.get(name);
			if (!module) {
				continue;
			}

			// @todo module.handlers[event] is not guaranteed here
			// void module.handlers[event](eventData);
		}
	}
}
