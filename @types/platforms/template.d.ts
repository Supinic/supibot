import {Emote, JSONifiable, Message} from "../globals";
import { Channel } from "../classes/channel";
import { User } from "../classes/user";

import { CytubePlatform } from "./cytube-platform";
import { DiscordPlatform } from "./discord-platform";
import { IrcPlatform } from "./irc-platform";
import { TwitchPlatform } from "./twitch-platform";

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

// @todo
declare type Client = any;

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
    // `true` by default
    caseSensitivity?: boolean;
};

/**
 * Represents a platform - a location where the bot can be active and respond to messages.
 * It is an API to manage communication between channels and the platform controller.
 */
export declare class Platform {
    static get (identifier: "Cytube" | "cytube"): CytubePlatform;
    static get (identifier: "Discord" | "discord"): DiscordPlatform;
    static get (identifier: "IRC" | "irc", host?: string): IrcPlatform;
    static get (identifier: "Twitch" | "twitch"): TwitchPlatform;
    static get (identifier: Like, host?: string): Platform | null;

    readonly userMessagePromises: Map<Channel, UserMessageAwaiterMap>;

    /**
     * Unique numeric platform identifier.
     */
    readonly ID: number;

    /**
     * Unique platform name. Always lowercase.
     */
    readonly name: string;

    /**
     * Specific host, in case the platform requires sub-specification.
     * E.g.: on IRC, this is the URL of the host.
     */
    readonly host: string | null;

    /**
     * Fallback message limit. Must be included.
     */
    readonly messageLimit: number;

    /**
     * Name of the bot's account in the given platform. Always lowercase.
     */
    readonly selfName: string | null;

    /**
     * Specific ID of the bot's account in given platform.
     * Can be null if the platform does not support UIDs.
     */
    readonly selfId: string | null;

    /**
     * A string identifier to recognize a platform for mirroring.
     */
    readonly mirrorIdentifier: string | null;

    /**
     * Settings related to logging permissions and levels.
     */
    readonly logging: Log | null;

    /**
     * Custom platform-specific data, parsed from JSON format.
     * It is merged with defaults on startup.
     */
    readonly config: Record<string, JSONifiable>; // is overridden in subclasses

    constructor (data: ConstructorOptions);

    /**
     * Determines if a user is an owner of a given channel (or equivalent, for the bot) in the platform.
     */
    isUserChannelOwner (channelData: Channel, userData: User): Promise<boolean | null>;

    /**
     * Sends a message into a given channel.
     * @todo When `supi-core` and `supibot` merge, expand the `options` type fully.
     */
    send (message: string, channel: string, options?: Object): Promise<void>;

    /**
     * Sends a private message to a given user.
     */
    pm (message: string, user: string, channelData?: Channel): Promise<void>;

    /**
     * For a given combination of channel and user, creates and returns a promise that will be resolved when the
     * provided user sends a message in the provided channel. The promise will be rejected if the user does not post
     * a message within a timeout specified in options.
     * @param channelData
     * @param userData
     * @param options
     * @param options.timeout Default: 10 seconds
     */
    waitForUserMessage (channelData: Channel, userData: User, options: MessageAwaiter["Options"]): Promise<MessageAwaiter["Resolution"]>;

    /**
     * For a provided channel, fetches its current user list using the platform's controller.
     */
    fetchChannelUserList (channelData: Channel): Promise<string[]>;
    fetchGlobalEmotes (): Promise<Emote[]>;
    invalidateGlobalEmotesCache (): Promise<void>;
    fetchChannelEmotes (channelData: Channel): Promise<Emote[]>;
    getBestAvailableEmote (channelData: Channel, emotes: string[], fallbackEmote: string, options: AvailableEmoteOptions): Promise<string | Emote>;
    prepareMessage (message: Message, channel: string, options: PrepareMessageOptions): Promise<string>;
    getFullName (separator: string): string;
    createUserMention (userData: User): Promise<string>;
    /**
     * Fetches the username for a given user platform ID, depending on which platform instance is used.
     */
    fetchUsernameByUserPlatformID (userPlatformID: string): Promise<string | null>
    /**
     * Fetches the platform ID for a given user object, depending on which platform instance is used.
     * Does not use the platforms' API for fetching, simply uses the internal sb.User data - and hence should not
     * be used long-term (more specifically, after the User_Alias refactor).
     */
    fetchInternalPlatformIDByUsername (userData: User): string | null;

    mirror (message: string, userData: User, channelData: Channel, options: Object): Promise<{ success: boolean }>;

    get capital (): string;
    get privateMessageLoggingTableName (): string;
    get client (): Client;
}
