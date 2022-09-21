import {
    Emote,
    Message,
    SimpleGenericData
} from "../globals";

import {
    CacheName,
    CacheValue,
    ClassTemplate,
    GenericCacheMap,
    SpecificCacheOptions
} from "./template";

import {
    APIType as BanphraseAPIType,
    DowntimeBehaviour as BanphraseDowntimeBehaviour
} from "./banphrase";

import {
    AvailableEmoteOptions,
    Like as PlatformLike,
    MessageAwaiter,
    Platform,
    PrepareMessageOptions
} from "./platform";

import { User } from "./user";
import { CustomDate } from "../objects/date";

import * as EventEmitter from "events";

declare type Controller = any; // @todo should be imported from github:supinic/supibot

export declare type Mode = "Inactive" | "Last seen" | "Read" | "Write" | "VIP" | "Moderator";
export declare type Like = string | number | Channel;

declare type ConstructorData = {
    ID: number;
    Name: string;
    Platform: Platform["ID"];
    Specific_ID: string | null;
    Mode: Mode;
    Mention: boolean;
    Links_Allowed: boolean;
    Banphrase_API_Type: BanphraseAPIType | null;
    Banphrase_API_Downtime: BanphraseDowntimeBehaviour | null;
    Message_Limit: number | null;
    NSFW: boolean;
    Mirror: Channel["ID"] | null;
    Description: string | null;
};
declare type MirrorOptions = {
    commandUsed: boolean;
};
declare type OfflineStreamData = {
    live: false;
    stream: {};
}
declare type OnlineStreamData = {
    live: true;
    stream: {
        game: string;
        since: CustomDate;
        status: string;
        viewers: number;
        quality: `${number}p`;
        fps: number;
        delay: number;
    }
}
declare type StreamData = OfflineStreamData | OnlineStreamData;
declare type MoveDataOptions = {
    deleteOriginalValues?: boolean;
    skipProperties?: string[];
};

/**
 * Represents a generic chat channel.
 */
export declare class Channel extends ClassTemplate {
    static readonly redisPrefix: string;
    static readonly cacheData: GenericCacheMap<Channel>;
    static readonly dataCache: WeakMap<Channel, Map<string, SimpleGenericData>>;

    /**
     * Returns a Channel object, based on the identifier provided, and a optional platform parameter.
     * @param identifier Channel identifier
     * @param platform If provided, only channels in the provided platform will be used.
     * @throws {sb.Error} If identifier type is not recognized
     */
    static get (identifier: Like, platform?: PlatformLike): Channel;

    /**
     * Fetches a list of channels the bot is set up to join for a given platform.
     */
    static getJoinableForPlatform (platform: PlatformLike): Channel[];

    /**
     * Creates a new channel, saves its definition to the database, and creates a logging table if needed.
     */
    static add (name: string, platformData: Platform, mode?: Mode, specificID?: string): Promise<Channel>;

    /**
     * Moves all existing channel-specific data from one channel to another one.
     */
    static moveData (oldChannelData: Channel, newChannelData: Channel, options?: MoveDataOptions): Promise<void>;

    /**
     * Normalizes non-standard strings into standardized database channel names.
     * Turns input string into lowercase, removes leading `@` and leading `#`.
     */
    static normalizeName (username: string): string;

    /**
     * Unique numeric ID.
     */
    readonly ID: number

    /**
     * Channel name. Must be unique in the scope of its {@link sb.Platform}.
     */
    readonly Name: string;

    /**
     * Platform object the channel belongs to.
     */
    readonly Platform: Platform;

    /**
     * Platform-specific ID.
     * Value of `null` is only permitted when the platform does not support channel IDs.
     * @type {string|null}
     */
    Specific_ID: string | null;

    /**
     * Channel mode - determines bot behaviour.
     * - `Inactive` - will not attempt to join, and will ignore every data and chat messages or commands.
     * - `Read` - will ignore all command requests.
     * - `Write` - normal mode, channel cooldown set at 1250 milliseconds - normalized for Twitch.
     * - `VIP` - elevated mode, channel cooldown set at 250 milliseconds - using the VIP mode, but also not spamming too much.
     * - `Moderator` - super mode, channel cooldown set at 50 milliseconds - only used in channels where it is OK to spam.
     */
    Mode: Mode;

    /**
     * If `true`, commands that are configured to mention the invoking user will do so.
     * If `false`, no mentions will be added.
     */
    Mention: boolean;

    /**
     * If `true`, all links that would otherwise be sent will be replaced with a placeholder string.
     */
    Links_Allowed: boolean;

    /**
     * Type of banphrase API.
     * If not null and {@link sb.Channel.Banphrase_API_URL} is also not null, all messages will be also checked against this banphrase API.
     */
    Banphrase_API_Type: BanphraseAPIType | null;

    /**
     * URL of banphrase API.
     * If not null and {@link sb.Channel.Banphrase_API_Type} is also not null, all messages will be also checked against this banphrase API
     */
    Banphrase_API_URL: string | null;

    /**
     * Bot behaviour when given banphrase API is not available (downtime).
     * - `Ignore` = Pretend as if the API was not there. Post messages as normal.
     * - `Notify` = As Ignore, but prepend a warning message that the API is unreachable.
     * - `Refuse` = Do not post the message at all, post a warning message instead.
     * - `(null)` = Default value for channels that have no banphrase API set up.
     */
    Banphrase_API_Downtime: BanphraseDowntimeBehaviour | null;

    /**
     * Channel-specific character limit for any message sent in it.
     * If null, uses the platform's message limit setting instead.
     */
    Message_Limit: number | null;

    /**
     * Flag specifying channel's NSFW status.
     * Mostly used for Discord channels.
     */
    NSFW: boolean;

    /**
     * Determines the level of logging for the specified channel.
     * - `Lines` - all chat lines will be logged
     * - `Meta` - metadata (such as "last seen") will be logged
     * @type {Set<"Lines"|"Meta">}
     */
    Logging: Set<"Lines"|"Meta">;

    /**
     * If not null, every message sent to this channel will also be mirrored to another channel with this specified ID.
     * Only 1-to-1 or one-way mirroring is supported.
     */
    Mirror: Channel["ID"] | null;

    /**
     * A human-readable description of the channel.
     */
    Description: string | null;

    /**
     * Session-specific data for a channel. Dynamically updated at runtime.
     * Is always reset on bot reset or channel reset.
     */
    sessionData: SimpleGenericData;

    /**
     * Wrapper for external channel events.
     * Used in chat-modules.
     */
    readonly events: EventEmitter;

    #setupPromise: Promise<boolean> | null;

    constructor (data: ConstructorData);

    /**
     * Sets up the logging table and triggers for a newly created channel.
     * @returns True if new tables and triggers were created, false if channel already has them set up
     */
    setup (): Promise<boolean>;

    /**
     * Waits until the user sends a message. Resolves with their response, or rejects if timed out.
     */
    waitForUserMessage (userID: number, options: MessageAwaiter["Options"]): MessageAwaiter["Resolution"];

    /**
     * Returns the database name for the logging table of a given channel.
     * Non-Twitch channels have their platform as lowercase prefix.
     * @example cytube_channel (Cytube)
     * @example discord_12345 (Discord)
     * @example some_channel (Twitch)
     * @returns {string}
     */
    getDatabaseName (): string;

    /**
     * Returns the full name of a channel, including its platform name.
     * For Discord, uses the guild rather than the actual channel name.
     */
    getFullName (): string;

    /**
     * Determines if a user is the owner of the channel the instances represents.
     * @param {User} userData
     */
    isUserChannelOwner (userData: User): Promise<boolean | null>;

    /**
     * Checks if a provided user is an ambassador of the channel instance
     * @param {User} userData
     * @returns {boolean}
     */
    isUserAmbassador (userData: User): Promise<boolean | null>;

    /**
     * Sends a message into the current channel.
     */
    send (message: Message): Promise<void>;

    /**
     * Returns the channel's stream-related data.
     */
    getStreamData (): Promise<StreamData | {}>;

    /**
     * Sets the channel's stream-related data.
     */
    setStreamData (data: any): ReturnType<ClassTemplate["setCacheData"]>;

    /**
     * Retrieves a channel data property value from the database.
     */
    getDataProperty (propertyName: CacheName, options?: SpecificCacheOptions): ReturnType<ClassTemplate["getGenericDataProperty"]>;

    /**
     * Saves a channel data property value into the database.
     */
    setDataProperty (propertyName: CacheName, value: CacheValue, options?: SpecificCacheOptions): ReturnType<ClassTemplate["setGenericDataProperty"]>;

    /**
     * Pushes a property change to the database.
     */
    saveProperty (property: string, value: any): ReturnType<ClassTemplate["saveRowProperty"]>;

    /**
     * Toggles a provided user's ambassador status in the current channel instance.
     */
    toggleAmbassador (userData: User): ReturnType<Channel["saveProperty"]>;

    /**
     * Mirrors the message to the given mirror channel, if this instance has been configured to do so.
     */
    mirror (message: Message, userData: User, options?: MirrorOptions): ReturnType<Controller["mirror"]>;

    /**
     * Returns the current list of users in the provided channel instance.
     */
    fetchUserList (): ReturnType<Platform["fetchChannelUserList"]>;

    /**
     * Returns the current list of emotes in the provided channel instance.
     */
    fetchEmotes (): Promise<Emote[]>;

    /**
     * Revokes all caches of emotes bound to the current channel.
     * They will be reloaded when next required.
     */
    invalidateEmotesCache (): ReturnType<ClassTemplate["setCacheData"]>;

    /**
     * Fetches the best fitting emote for the current channel instance, based on a list of provided emotes or words.
     * @param emotes Array of emotes as strings.
     * The "best" fetching emote will be chosen iterating through the array and picking the first one that is available
     * in the current channel instance.
     * @param fallbackEmote If none of the provided emotes are available in the channel, this string will be used instead.
     * @param options
     * @param options.returnEmoteObject If `true`, an object with its full definition will be returned instead of an emote string.
     * @param options.filter Filter function used to choose from the available emotes. Receives `Emote` as input
     */
    getBestAvailableEmote (emotes: string[], fallbackEmote: string, options: AvailableEmoteOptions): Promise<string|Emote>;
    prepareMessage (message: Message, options: PrepareMessageOptions): ReturnType<Platform["prepareMessage"]>;
    getCacheKey (): string;

    serialize (): Promise<never>;
}
