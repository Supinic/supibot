import { Emote, Message } from "../globals";
import { ClassTemplate } from "./template";
import { Channel } from "./channel";
import { User } from "./user";

import { CytubePlatform } from "./platforms/cytube-platform";
import { DiscordPlatform } from "./platforms/discord-platform";
import { IrcPlatform } from "./platforms/irc-platform";
import { TwitchPlatform } from "./platforms/twitch-platform";

declare type Controller = any; // @todo from github:supinic/supibot
declare type Client = any; // @todo from github:supinic/supibot

declare type ConstructorOptions = {
	ID: number;
	Name: string;
	Host: string | null;
	Message_Limit: number;
	Self_Name: string | null;
	Self_ID: string | null;
	Mirror_Identifier: string | null;
	Logging: Log | null;
	Defaults: Record<string, any>;
	Data: Record<string, any>;
};
declare type UserMessageAwaiterMap = Map<User, MessageAwaiter["Resolution"]>;
declare type PrepareMessageOptions = {
	extraLength?: number;
	removeEmbeds?: boolean;
};

export declare interface Log {
	messages: boolean;
	whispers: boolean;
}
export declare interface MessageAwaiter {
	Wrapper: {
		timeout: number,
		promise: MessageAwaiter["Resolution"]
	};
	Resolution: {
		message: Message;
	};
	Options: {
		timeout?: number;
	};
}
export declare type Like = number | string | Platform;
export declare type AvailableEmoteOptions = {
	shuffle?: boolean;
	returnEmoteObject?: boolean;
	filter?: (value: Emote) => boolean;
};

export declare class Platform extends ClassTemplate {
	static assignControllers (controllers: Record<string, Controller>): void;

	static get (identifier: "Cytube" | "cytube"): CytubePlatform;
	static get (identifier: "Discord" | "discord"): DiscordPlatform;
	static get (identifier: "IRC" | "irc"): IrcPlatform;
	static get (identifier: "Twitch" | "twitch"): TwitchPlatform;
	static get (identifier: Like, host?: string): Platform | null;

	readonly controller: Controller;
	readonly userMessagePromises: Map<Channel, UserMessageAwaiterMap>;
	readonly ID: number;
	readonly Name: string;
	readonly Host: string | null;
	readonly Message_Limit: number;
	readonly Self_Name: string | null;
	readonly Self_ID: string | null;
	readonly Mirror_Identifier: string | null;
	readonly Logging: Log | null;
	readonly Defaults: Partial<Platform["Data"]>;
	readonly Data: Record<string, any>; // is overridden in subclasses

	constructor (data: ConstructorOptions);

	isUserChannelOwner (channelData: Channel, userData: User): Promise<boolean | null>;
	send (message: string, channel: string): Promise<void>;
	pm (message: string, user: string, channelData?: Channel): Promise<void>;
	waitForUserMessage (channelData: Channel, userData: User, options: MessageAwaiter["Options"]): Promise<MessageAwaiter["Resolution"]>;
	fetchChannelUserList (channelData: Channel): Promise<string[]>;
	fetchGlobalEmotes (): Promise<Emote[]>;
	invalidateGlobalEmotesCache (): Promise<void>;
	fetchChannelEmotes (channelData: Channel): Promise<Emote[]>;
	getBestAvailableEmote (channelData: Channel, emotes: string[], fallbackEmote: string, options: AvailableEmoteOptions): Promise<string | Emote>;
	prepareMessage (message: Message, channel: string, options: PrepareMessageOptions): Promise<string>;
	getFullName (separator: string): string;
	getCacheKey (): string;
	createUserMention (userData: User): Promise<string>;

	get capital (): string;
	get privateMessageLoggingTableName (): string;
	get client (): Client;
}
