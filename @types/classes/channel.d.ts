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

export declare class Channel extends ClassTemplate {
    static readonly redisPrefix: string;
    static readonly cacheData: GenericCacheMap<Channel>;

    static get (identifier: Like, platform?: PlatformLike): Channel;
    static getJoinableForPlatform (platform: PlatformLike): Channel[];
    static add (name: string, platformData: Platform, mode?: Mode, specificID?: string): Promise<Channel>;

    static moveData (oldChannelData: Channel, newChannelData: Channel, options?: MoveDataOptions): Promise<void>;
    static normalizeName (username: string): string;

    readonly ID: number;
    readonly Name: string;
    readonly Platform: Platform;
    Specific_ID: string | null;
    Mode: Mode;
    Mention: boolean;
    Links_Allowed: boolean;
    Banphrase_API_Type: BanphraseAPIType | null;
    Banphrase_API_Downtime: BanphraseDowntimeBehaviour | null;
    Message_Limit: number | null;
    NSFW: boolean;
    Logging: Set<"Lines"|"Meta">;
    Mirror: Channel["ID"] | null;
    Description: string | null;
    readonly sessionData: SimpleGenericData;
    readonly events: EventEmitter;

    constructor (data: ConstructorData);

    setup (): Promise<boolean>;
    waitForUserMessage (userID: number, options: MessageAwaiter["Options"]): MessageAwaiter["Resolution"];
    getDatabaseName (): string;
    getFullName (): string;
    isUserChannelOwner (userData: User): Promise<boolean | null>;
    isUserAmbassador (userData: User): Promise<boolean | null>;
    send (message: Message): Promise<void>;
    getStreamData (): Promise<StreamData | {}>;
    setStreamData (data: any): ReturnType<ClassTemplate["setCacheData"]>;
    getDataProperty (propertyName: CacheName, options?: SpecificCacheOptions): ReturnType<ClassTemplate["getGenericDataProperty"]>;
    setDataProperty (propertyName: CacheName, value: CacheValue, options?: SpecificCacheOptions): ReturnType<ClassTemplate["setGenericDataProperty"]>;
    saveProperty (property: string, value: any): ReturnType<ClassTemplate["saveRowProperty"]>;
    toggleAmbassador (userData: User): ReturnType<Channel["saveProperty"]>;
    mirror (message: Message, userData: User, options?: MirrorOptions): ReturnType<Controller["mirror"]>;
    fetchUserList (): ReturnType<Platform["fetchChannelUserList"]>;
    fetchEmotes (): Promise<Emote[]>;
    invalidateEmotesCache (): ReturnType<ClassTemplate["setCacheData"]>;
    getBestAvailableEmote (emotes: string[], fallbackEmote: string, options: AvailableEmoteOptions): Promise<string|Emote>;
    prepareMessage (message: Message, options: PrepareMessageOptions): ReturnType<Platform["prepareMessage"]>;
    getCacheKey (): string;

    serialize (): Promise<never>;
}
