import { GenericFlagsObject, SimpleGenericData, TypeExtract } from "../globals";
import { ClassTemplate } from "./template";
import { Channel } from "./channel";
import { Platform } from "./platform";
import { Permissions as UserPermissions, User } from "./user";
import { Language } from "language-iso-codes";
import { CustomDate as Date } from "../objects/date";
import { DeepFrozen } from "../singletons/utils";

import { PoolConnection } from "mariadb";

declare type DiscordEmbedDefinition = {
    title: string;
    color?: string;
    url?: string;
    author?: {
        name: string;
        icon_url?: string;
        url?: string;
    };
    description?: string;
    fields: {
        name: string;
        value: string;
        inline?: boolean;
    }[];
    image?: {
        url: string;
    };
    timestamp?: Date;
    footer?: {
        text: string;
        icon_url?: string;
    }
};

export declare namespace Parameter {
    type Type = "string" | "number" | "boolean" | "date" | "object" | "regex" | "language";
    type ParsedType = string | number | boolean | Date | SimpleGenericData | RegExp | Language;
    type Descriptor = {
        type: Type;
        name: string
    };
}
export declare type Result = {
    reply: string | null;
    success?: boolean;
    cooldown?: CooldownDescriptor;
    reason?: string;
    meta?: never;
    discord?: {
        embeds?: DiscordEmbedDefinition[]
    };
    partialExecute?: boolean;
    hasExternalInput?: boolean;
    isChannelAlias?: boolean;
    skipExternalPrefix?: boolean;
    forceExternalPrefix?: boolean;
    replyWithPrivateMessage?: boolean;
    removeEmbeds?: boolean;
    keepWhitespace?: boolean

    /**
     * @typedef {Object} CommandResult
     * @property {boolean} success If true, result contains reply; if false, result contains error
     * @property {string} [reply] Command result as a string to reply. If not provided, no message should be sent
     * @property {Object} [cooldown] Dynamic cooldown settings
     * @property {string} [reason] Symbolic description of why command execution failed - used internally
     * @property {Object} [meta] Any other information passed back from the command execution
     * @property {boolean} [partialExecute] Determines if a command is used as a part of a different meta-command
     * @property {boolean} [hasExternalInput] Determines if a command can have arbitrary input - used for the "external prefix" symbol
     * @property {boolean} [isChannelAlias] Determines whether the executed alias is a channel-published one
     * @property {boolean} [skipExternalPrefix] If `hasExternalInput` is true, this flag can override it and remove the symbol
     * @property {boolean} [forceExternalPrefix] If true, the external prefix will be added even if the command's success flag is `false`
     * @property {boolean} [replyWithPrivateMessage] If true, the command reply should be sent via PMs
     * @property {boolean} [removeEmbeds] Determines if the command response should be embed or not
     * @property {boolean} [keepWhitespace] If true, the command's response will not be automatically stripped from whitespace
     */
};
export declare interface FlagsObject extends GenericFlagsObject {
    developer: boolean;
    system: boolean;
    optOut: boolean;
    skipBanphrase: boolean;
    block: boolean;
    ownerOverride: boolean;
    readOnly: boolean;
    whitelist: boolean;
    pipe: boolean;
    mention: boolean;
    nonNullable: boolean;
    externalInput: boolean;
    /**
     * @typedef {Object} CommandFlagsObject
     * @property {boolean} developer If true, the command will be hidden from the command list, unless the person is marked as a developer.
     * @property {boolean} system If true, the command will be hidden (even from developers) and only shown to admins.
     * @property {boolean} rollback Determines if command is rollbackable.
     * If true, all sensitive database operations will be handled in a transaction - provided in options object.
     * @property {boolean} optOut If true, any user can "opt-out" from being the target of the command.
     * If done, nobody will be able to use their username as the command parameter.
     * @property {boolean} skipBanphrase If true, command result will not be checked for banphrases.
     * Mostly used for system or simple commands with little or no chance to trigger banphrases.
     * @property {boolean} block If true, any user can "block" another user from targetting them with this command.
     * If done, the specified user will not be able to use their username as the command parameter.
     * Similar to optOut, but not global, and only applies to one user.
     * @property {boolean} ownerOverride If true, the command's cooldown will be vastly reduced when a user invokes it in their own channel.
     * @property {boolean} readOnly If true, command is guaranteed to not reply, and as such, no banphrases, cooldowns or pings are checked.
     * @property {boolean} whitelist If true, command is only accessible to certain users or channels, or their combination.
     * @property {boolean} pipe If true, the command can be used as a part of the "pipe" command.
     * @property {boolean} mention If true, command will attempt to mention its invokers by adding their username at the start.
     * This also requires the channel to have this option enabled.
     * @property {boolean} nonNullable If true, the command cannot be directly piped into the null command
     * @property {boolean} externalInput If true, the command is marked as being able to receive aribtrary user input - used in meta-commands
     */
}
export declare type Like = string | Command;

declare type ContextConstructorData = {
    invocation: string;
    user: User;
    channel: Channel | null;
    platform: Platform;
    transaction: PoolConnection
};
declare type ConstructorData = {
    Name: string;
    Aliases: string[] | null;
    Description: string | null;
    Cooldown: number | null;
    Flags: (keyof FlagsObject)[] | Partial<FlagsObject> | null;
    Params: Parameter.Descriptor[];
    Whitelist_Response: string | null;
    Author: string | null;
    Code: (this: Command, context: Context, ...args: string[]) => (Result | Promise<Result>);
    Static_Data: (() => Record<string, any>) | null;
};
export declare type Definition = ConstructorData & {
    Dynamic_Description: ((prefix: string, values: never) => Promise<string[]>) | null;
};

declare type AppendData = {
    platform: Platform;
    tee?: Readonly<string[]>;
    pipe?: boolean;
    skipBanphrases?: boolean;
    skipPending?: boolean;
    skipMention?: boolean;
    partialExecute?: boolean;
    alias?: boolean;
    aliasArgs?: string[];
    aliasCount?: number;
    aliasStack?: string[];
    aliasTry?: {
        user: User["Name"];
    };
};
declare type PermissionsDescriptor = {
    flag: UserPermissions.Value;
    is: (type: UserPermissions.Level) => boolean;
};
declare type ContextSpecificator = {
    user?: User;
    channel?: Channel;
    platform?: Platform;
};
declare type ExecutionOptions = {
    internalExecution?: boolean;
    skipGlobalBan?: boolean;
    skipMention?: boolean;
    platform?: Platform;
};
declare type Cooldown = number | null;
declare type CooldownObject = {
    length: Cooldown,
    user?: string;
    command?: string;
    channel?: number;
};
declare type CooldownDescriptor = Cooldown | CooldownObject;
declare type CommandFailure = {
    success: false;
    reply?: string;
};
declare type ParsedParametersData = {
    parameters: Record<string, Parameter.ParsedType>;
    args: string[];
};

declare type ParameterParseFailure = {
    success: true,
    newParameters: Record<string, SimpleGenericData>
};
declare type ParameterParseSuccess = {
    success: false,
    reply: string
};
declare type ParameterParseResult = ParameterParseFailure | ParameterParseSuccess;

/**
 * Represents the context a command is being executed in.
 */
export declare class Context {
    #command: Command;
    #invocation: string;
    #user: User;
    #channel: Channel;
    #platform: Platform;
    #transaction: PoolConnection | null;
    #privateMessage: boolean;
    #append: AppendData;
    #params: Record<string, Parameter.ParsedType>;
    #userFlags: FlagsObject;
    #meta: Map<string, any>;

    constructor (command: Command, data: ContextConstructorData);

    getMeta (name: string): void;
    setMeta (name: string, value: any): void;

    /**
     * Fetches an object wrapper describing the user's permissions in given command context.
     * @param options When provided, allows overriding the command context's properties.
     */
    getUserPermissions (options: ContextSpecificator): Promise<PermissionsDescriptor>;

    /**
     * Fetches the best available emote for given context - based on platform/channel availability.
     * @param emotes Array of emotes as strings.
     * The "best" fetching emote will be chosen iterating through the array and picking the first one that is available
     * in the current channel instance.
     * @param fallbackEmote If none of the provided emotes are available in the channel, this string will be used instead.
     * @param options
     * @param options.returnEmoteObject If `true`, an object with its full definition will be returned instead of an emote string.
     * @param options.filter Filter function used to choose from the available emotes. Receives `Emote` as input
     */
    getBestAvailableEmote: Channel["getBestAvailableEmote"];
    getMentionStatus (): boolean;

    /**
     * Sends a message to the current channel or the PM channel, depending on the usage.
     * This method should only be used to send intermittent updates, it does not serve as the command response.
     */
    sendIntermediateMessage (string: string): Promise<void>;

    get tee (): string[]
    get invocation (): string;
    get user (): User;
    get channel (): Channel;
    get platform (): Platform;
    get transaction (): PoolConnection | null;
    get privateMessage (): boolean;
    get append (): AppendData;
    get params (): Record<string, Parameter.ParsedType>;
    get userFlags (): FlagsObject;
}

/**
 * Represents a bot command, providing API to execute it and access its internals.
 */
export declare class Command extends ClassTemplate {
    /**
     * Checks if the given string counts as a proper command execution.
     * @param string
     */
    static is (string: string): boolean;
    static getPrefix (): string;
    static setPrefix (value: string): void;
    static get (identifier: Like): Command | null;
    static validate (): void;

    /**
     * Extracts all boolean values from a command execution result.
     * @param execution
     */
    static extractMetaResultProperties (execution: Result): TypeExtract<Result, boolean>;

    /**
     * Creates a functioning command context, with data filled in based on what data is passed
     * @param commandData
     * @param contextData
     * @param extraData
     */
    static createFakeContext (commandData: Command, contextData: ContextConstructorData, extraData: SimpleGenericData): Context;
    static parseParameter (value: string, type: Parameter.Type, explicit?: boolean): Parameter.ParsedType;

    /**
     * For an input params definition and command arguments, parses out the relevant parameters along with their
     * values converted properly from string.
     * @param paramsDefinition Definition of parameters to parse out of the arguments
     * @param argsArray The arguments to parse from
     */
    static parseParametersFromArguments (
        paramsDefinition: Parameter.Descriptor[],
        argsArray: string[]
    ): ParsedParametersData | CommandFailure;

    /**
     * Checks if a command exists, and then executes it if needed.
     * @param identifier
     * @param argumentArray
     * @param channelData
     * @param userData
     * @param options Any extra options that will be passed to the command as extra.append
     * @param options.internalExecution currently unused
     * @param options.skipGlobalBan
     * @param options.platform
     * @param options.skipMention If true, no mention will be added to the command string, regardless of other options.
     */
    static checkAndExecute (
        identifier: string,
        argumentArray: string[],
        channelData: Channel | null,
        userData: User,
        options: ExecutionOptions
    ): Result;

    /**
     * Handles the setting (or skipping) cooldowns for given combination of data.
     * @param channelData
     * @param userData
     * @param commandData
     * @param cooldownData
     */
    static handleCooldown (
        channelData: Channel | null,
        userData: User,
        commandData: Command,
        cooldownData: CooldownDescriptor
    ): void;
    static get prefix (): string;
    static set prefix (value: string);
    static get prefixRegex (): RegExp;
    static validate (): void;

    /**
     * Parse a parameter value from a string, and return a new parameters object with the parameter set.
     * Fails parameter value cannot be parsed, or conflicts with previous parameters allowed.
     * @param value
     * @param parameterDefinition
     * @param explicit
     * @param existingParameters Parameters already parsed
     */
    static #parseAndAppendParameter (
        value: string,
        parameterDefinition: Parameter.Descriptor,
        explicit: boolean,
        existingParameters: Record<string, SimpleGenericData>
    ): ParameterParseResult;

    static readonly #privateMessageChannelID: unique symbol;

    /**
     * Privileged command characters are such characters, that when a command is invoked, there does not have to be any
     * whitespace separating the character and the first argument.
     * Consider the bot's prefix to be "!", and the test command string to be `!$foo bar`.
     * @example If "$" is not privileged:
     * prefix = "!"; command = "$foo"; arguments = ["bar"];
     * @example If "$" is privileged:
     * prefix = "!"; command = "$"; arguments = ["foo", "bar"];
     */
    private static privilegedCommandCharacters: string[];

    /**
     * Command parameter parsing will only continue up until this argument is encountered, and not part
     * of a parameter.
     * The delimiter must not contain any spaces.
     * If it is not defined or falsy, commands will use up the entire string instead.
     * @example If there is no delimiter:
     * "$foo bar:baz -- bar:zed"; { bar: "zed" }
     * @example If "--" is the delimiter:
     * "$foo bar:baz -- bar:zed"; { bar: "baz" }
     * "$foo bar:\"baz -- buz\" -- bar:zed"; { bar: "baz -- buz" }
     */
    private static ignoreParametersDelimiter: string;

    /**
     * Unique command name.
     */
    readonly Name: string;

    /**
     * Array of string aliases.
     * These are used as variable invocations for the command to execute.
     */
    readonly Aliases: string[];

    /**
     * Command description. Also used for the `help` meta command.
     */
    readonly Description: string | null;

    /**
     * Command cooldown, in milliseconds.
     * If `null`, no cooldown is set at at all (!)
     */
    readonly Cooldown: number | null;

    /**
     * Holds all flags of a command, all of which are booleans.
     * This object is frozen after initialization, so that the flags can only be modified outside of runtime.
     */
    readonly Flags: Readonly<FlagsObject>;

    /**
     * Contains info about the command's parameters.
     */
    readonly Params: Readonly<Parameter.Descriptor[]>;

    /**
     * If not null, this is the response for a whitelisted command when invoked outside of the whitelist.
     */
    readonly Whitelist_Response: string | null;

    /**
     * The actual code function of the command.
     */
    private Code: (context: Context, ...args: string[]) => Result;

    /**
     * Session-specific data for the command that can be modified at runtime.
     */
    private data: SimpleGenericData;

    /**
     * Data specific for the command. Usually hosts utils methods, or constants.
     * The object is deeply frozen, preventing any changes.
     */
    private staticData: DeepFrozen<Record<string, any>>;

    /**
     * Determines the author of the command. Used for updates and further command downloads.
     * If null, the command is considered to be created anonymously.
     */
    #Author: string | null;

    constructor (data: ConstructorData);

    /**
     * Wrapper for the internal `Code` function, allowing execution from outside of the internal scope.
     */
    execute (...args: Parameters<Command["Code"]>): ReturnType<Command["Code"]>;

    /**
     * Creates the command's detail URL based on a Configuration variable
     * @param options
     * @param options.useCodePath If true, returns a path for the command's code description
     */
    getDetailURL (options?: { useCodePath?: boolean }): string;
}
