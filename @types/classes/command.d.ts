import { GenericFlagsObject, SimpleGenericData, TypeExtract } from "../globals";
import { ClassTemplate } from "./template";
import { Channel } from "./channel";
import { AvailableEmoteOptions, Platform } from "./platform";
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

export declare class Context {
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
    getUserPermissions (options: ContextSpecificator): Promise<PermissionsDescriptor>;
    getBestAvailableEmote (emote: string[], fallback: string, options: AvailableEmoteOptions): Promise<string>;

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

export declare class Command extends ClassTemplate {
    static is (string: string): boolean;
    static getPrefix (): string;
    static setPrefix (value: string): void;
    static get (identifier: Like): Command | null;
    static validate (): void;
    static extractMetaResultProperties (execution: Result): TypeExtract<Result, boolean>;
    static createFakeContext (commandData: Command, contextData: ContextConstructorData, extraData: SimpleGenericData): Context;
    static parseParameter (value: string, type: Parameter.Type, explicit?: boolean): Parameter.ParsedType;
    static parseParametersFromArguments (
        paramsDefinition: Parameter.Descriptor[],
        argsArray: string[]
    ): ParsedParametersData | CommandFailure;
    static checkAndExecute (
        identifier: string,
        argumentArray: string[],
        channelData: Channel | null,
        userData: User,
        options: ExecutionOptions
    ): Result;
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
    static readonly #privateMessageChannelID: unique symbol;
    private static privilegedCommandCharacters: string[];

    readonly Name: string;
    readonly Aliases: string[];
    readonly Description: string | null;
    readonly Cooldown: number | null;
    readonly Flags: Readonly<FlagsObject>;
    readonly Params: Readonly<Parameter.Descriptor[]>;
    readonly Whitelist_Response: string | null;
    private readonly Author: string | null;
    private Code: (context: Context, ...args: string[]) => Result;
    private data: SimpleGenericData;
    private staticData: DeepFrozen<Record<string, any>>;

    constructor (data: ConstructorData);

    execute (...args: Parameters<Command["Code"]>): ReturnType<Command["Code"]>;
    getDetailURL (options?: { useCodePath?: boolean }): string;
}
