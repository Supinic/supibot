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
        administrator: 0b1000_0000;
    };
    export type Level = keyof Descriptor;
    export type Value = Descriptor[keyof Descriptor];
}

export declare type Like = string | number | User;

declare type UserGetOptions = {
    Discord_ID?: string | null;
    Twitch_ID?: string | null;
};

/**
 * Represents a chat user.
 * Since there can be hundreds of thousands of users loaded, a class is used to simplify the prototype, and potentially save some memory and/or processing power with V8.
 */
export declare class User extends ClassTemplate {
    static bots: Map<User["ID"], User>;
    static data: Map<string, User>;

    static readonly permissions: Permissions.Descriptor;
    static readonly dataCache: GenericCacheMap<User>;
    static readonly mapExpirationInterval: ReturnType<typeof setInterval>;

    static readonly mapCacheExpiration: number;
    static readonly redisCacheExpiration: number;
    static readonly pendingNewUsers: Map<string, Promise<User>>;

    static #add (name: string, properties?: UserGetOptions): Promise<User>;

    /**
     * Adds a new user to the database, only if necessary.
     * If the user exists or is being added at the moment, cached data or a pending Promise is return respectively.
     */
    static add (name: string, properties?: UserGetOptions): Promise<User>;
    /**
     * Searches for a user, based on their ID, or Name.
     * @param identifier
     * @param strict If false and searching for user via string, and it is not found, creates a new User.
     * @param options Includes possible platform IDs for given user
     */
    static get (identifier: Like, strict?: boolean, options?: UserGetOptions): Promise<User|null>;
    /**
     * Fetches a batch of users together.
     * Takes existing records from cache, the rest is pulled from database.
     * Does not support creating new records like `get()` does.
     */
    static getMultiple (identifier: Like[]): Promise<User[]>;
    /**
     * Synchronously fetches a user based on their numeric ID.
     * No other types of ID are supported.
     */
    static getByProperty (property: string, identifier: any): User;
    /**
     * Normalizes non-standard strings into standard usernames.
     * Turns input string into lowercase.
     * Removes leading `@`, leading `#`, and trailing `:` symbols.
     * Replaces all consecutive whitespace with a single `_` symbol.
     */
    static normalizeUsername (username: string): string;
    static createCacheKey (options: { name?: string, Name?: string }): string;
    /**
     * For a given username, creates a User object instance from the L2 cache.
     */
    static createFromCache (options: { name?: string, Name?: string }): Promise<User>;
    /**
     * For a given username, populates all levels of cache for the User.
     * I.e. creates and sets the User object (L1) and populates sb.Cache (L2)
     */
    static populateCaches (user: string): Promise<void>;
    static destroy (): void;


    readonly ID: number;
    readonly Name: string;
    readonly Discord_ID: string | null;
    readonly Twitch_ID: string | null;
    readonly Started_Using: Date;

    /** @deprecated */
    private Data: never;

    getCacheKey (): string;

    /**
     * Pushes a property change to the database.
     */
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
}
