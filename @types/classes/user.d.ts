import {
    CacheName,
    CacheValue,
    ClassTemplate,
    GenericCacheMap,
    SpecificCacheOptions
} from "./template";

export declare namespace Permissions {
    export type Descriptor = {
        regular: 0b0000_0001;
        ambassador: 0b0000_0010;
        channelOwner: 0b0000_0100;
        administrator: 0b0000_1000;
    };
    export type Level = keyof Descriptor;
    export type Value = Descriptor[keyof Descriptor];
}

export declare type Like = string | number | User;

declare type UserGetOptions = {
    Discord_ID?: string;
    Twitch_ID?: string;
};

export declare class User extends ClassTemplate {
    static bots: Map<string, User>;
    static data: Map<string, User>;
    static readonly permissions: Permissions.Descriptor;
    static readonly dataCache: GenericCacheMap<User>;
    static readonly mapExpirationInterval: ReturnType<typeof setInterval>;
    static readonly pendingNewUsers: Set<User>;
    static readonly mapCacheExpiration: number;
    static readonly redisCacheExpiration: number;

    static add (name: string): Promise<User>;
    static get (identifier: Like, strict?: boolean, options?: UserGetOptions): Promise<User|null>;
    static getMultiple (identifier: Like[]): Promise<User[]>;
    static getByProperty (property: string, identifier: any): User;
    static destroy (): void;
    static normalizeUsername (username: string): string;
    static createCacheKey (options: { name?: string, Name?: string }): string;
    static createFromCache (options: { name?: string, Name?: string }): Promise<User>;
    static populateCaches (user: string): Promise<void>;

    readonly ID: number;
    readonly Name: string;
    readonly Discord_ID: string | null;
    readonly Twitch_ID: string | null;
    readonly Started_Using: Date;

    /** @deprecated */
    private Data: never;

    getCacheKey (): string;
    saveProperty (property: string, value: any): Promise<void>;
    /**
     * Fetches a user data propertyName from the database.
     * Returns:
     * - `undefined` if propertyName doesn't exist
     * - `null` or any respective primitive/object/function value as determined by the saved value
     */
    getDataProperty (propertyName: CacheName, options?: SpecificCacheOptions): ReturnType<ClassTemplate["getGenericDataProperty"]>;
    /**
     * Saves a user data property into the database.
     */
    setDataProperty (propertyName: CacheName, value: CacheValue, options?: SpecificCacheOptions): ReturnType<ClassTemplate["setGenericDataProperty"]>;
    serialize (): never;
}
