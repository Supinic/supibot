import {
	SupiDate,
	SupiError,
	isGenericRequestError,
	isGotRequestError,
	type Counter,
	type Query,
	type MetricConfiguration,
	type MetricType
} from "supi-core";
import type { BaseMessageOptions } from "discord.js";

type DiscordEmbeds = BaseMessageOptions["embeds"];

import { TemplateWithoutId, TemplateDefinition } from "./template.js";

import Banphrase from "./banphrase.js";
import { Filter } from "./filter.js";
import User from "./user.js";
import { Channel, privateMessageChannelSymbol } from "./channel.js";
import { Platform, type GetEmoteOptions } from "../platforms/template.js";
import CooldownManager from "../utils/cooldown-manager.js";
import { type Language, getLanguage } from "../utils/languages.js";

import type { MessageData as TwitchAppendData } from "../platforms/twitch.js";
import type { MessageData as DiscordAppendData } from "../platforms/discord.js";

import { whitespaceRegex } from "../utils/regexes.js";
import config from "../config.json" with { type: "json" };
import { Emote } from "../@types/globals.js";

const COMMAND_PREFIX = config.modules.commands.prefix;
const LINEAR_REGEX_FLAG = "--enable-experimental-regexp-engine";

type QueryTransaction = Awaited<ReturnType<Query["getTransaction"]>>;

type ParameterValueMap = {
	string: string;
	number: number;
	boolean: boolean;
	date: SupiDate;
	object: Record<string, string>;
	regex: RegExp;
	language: Language;
};
type ParameterType = keyof ParameterValueMap;
type ParameterValue = ParameterValueMap[ParameterType];
type ParameterDefinition = {
	readonly name: string;
	readonly type: ParameterType;
};
type ParameterDefinitions = readonly ParameterDefinition[];

type ParamFromDefinition<T extends ParameterDefinitions> = {
	[P in T[number] as P["name"]]: ParameterValueMap[P["type"]] | undefined;
};

type AppendedParameters = Record<string, ParameterValue>;
type ResultFailure = { success: false; reply: string; };

export type StrictResult = {
	success?: boolean;
	reply?: string | null;
	replyWithPrivateMessage?: boolean;
	cooldown?: CooldownDefinition;
	partialReplies?: {
		bancheck: boolean;
		message: string;
	}[];
	isChannelAlias?: boolean;
	hasExternalInput?: boolean;
	skipExternalPrefix?: boolean;
	forceExternalPrefix?: boolean;
	meta?: {
		skipBanphrases?: boolean;
		skipWhitespaceCheck?: boolean;
	}
};
type Result = StrictResult & {
	reason?: string;
	replyWithMeAction?: boolean;
	discord?: {
		embeds?: DiscordEmbeds;
		reactions: string[] | { emoji: string; }[];
	};
};

export type Invocation = string;
export type ContextData<T extends ParameterDefinitions = ParameterDefinitions> = {
	user: Context<T>["user"]
	platform: Context<T>["platform"];
	invocation?: Context<T>["invocation"];
	channel?: Context<T>["channel"];
	transaction?: Context<T>["transaction"];
	privateMessage?: Context<T>["privateMessage"];
	append?: Context<T>["append"];
	platformSpecificData: Context<T>["platformSpecificData"];
	params?: Context<T>["params"];
};
export type ContextAppendData = {
	tee?: Invocation[];
	pipe?: boolean;
	aliasCount?: number;
	commandList?: Command["Name"][];
	aliasStack?: Command["Name"][];
	flags?: unknown;
	id?: string;
	messageID?: string;
	badges?: unknown;
	emotes?: unknown;
	skipPending?: boolean;
	privateMessage?: boolean;
	platform?: never; // @todo this is a temporary check for refactor purposes
};
export type ContextPlatformSpecificData = TwitchAppendData | DiscordAppendData | null;

type PermissionOptions = {
	user?: User | null;
	channel?: Channel | null;
	platform?: Platform | null;
};
type BestEmoteOptions = Partial<Pick<ContextData, "channel" | "platform"> & GetEmoteOptions>;

export type Flag = "block" | "developer" | "external-input" | "mention" | "non-nullable" | "opt-out"
	| "read-only" | "ping" | "pipe" | "rollback" | "skip-banphrase" | "system" | "whitelist";

export class Context<T extends ParameterDefinitions = ParameterDefinitions> {
	readonly command: Command;
	readonly invocation: string;
	readonly user: User;
	readonly platform: Platform;
	readonly channel: Channel | null;
	readonly transaction: QueryTransaction | null;
	readonly privateMessage: boolean;
	readonly append: ContextAppendData;
	readonly platformSpecificData: ContextPlatformSpecificData;
	readonly params: ParamFromDefinition<T>;

	// readonly meta: Map<string, unknown> = new Map();

	constructor (command: Command, data: ContextData<T>) {
		this.command = command;
		this.user = data.user;
		this.invocation = data.invocation ?? command.Name;
		this.channel = data.channel ?? null;
		this.platform = data.platform;
		this.transaction = data.transaction ?? null;
		this.privateMessage = data.privateMessage ?? false;

		this.append = data.append ?? {
			tee: []
		};

		this.append.tee ??= [];

		this.platformSpecificData = data.platformSpecificData ?? null;

		this.params = (data.params ?? {}) as ParamFromDefinition<T>;
	}

	// getMeta (name: string) { return this.meta.get(name); }
	// setMeta (name: string, value: unknown) { this.meta.set(name, value); }

	getMentionStatus (): boolean {
		return Filter.getMentionStatus({
			user: this.user,
			command: this.command,
			channel: this.channel ?? null,
			platform: this.platform
		});
	}

	async sendIntermediateMessage (string: string) {
		if (this.channel) {
			await Promise.all([
				this.channel.send(string),
				this.channel.mirror(string, null)
			]);
		}
		else {
			await this.platform.pm(string, this.user);
		}
	}

	async getUserPermissions (options: PermissionOptions = {}) {
		const userData = options.user ?? this.user;
		const channelData = options.channel ?? this.channel;
		const platformData = options.platform ?? this.platform;

		const promises: (Promise<boolean | null> | null)[] = [
			userData.getDataProperty("administrator") as Promise<boolean | null>
		];
		if (channelData) {
			promises.push(
				channelData.isUserAmbassador(userData),
				platformData.isUserChannelOwner(channelData, userData)
			);
		}

		const data = await Promise.all(promises);
		const flags = {
			administrator: (data[0] === true),
			ambassador: Boolean(data[1]),
			channelOwner: Boolean(data[2])
		};

		let flag = User.permissions.regular;
		if (flags.administrator) {
			// eslint-disable-next-line no-bitwise
			flag |= User.permissions.administrator;
		}
		if (flags.channelOwner) {
			// eslint-disable-next-line no-bitwise
			flag |= User.permissions.channelOwner;
		}
		if (flags.ambassador) {
			// eslint-disable-next-line no-bitwise
			flag |= User.permissions.ambassador;
		}

		return {
			flag,
			// eslint-disable-next-line no-bitwise
			is: (type: keyof typeof User.permissions) => ((flag & User.permissions[type]) !== 0)
		};
	}

	async getBestAvailableEmote <T extends string> (emotes: T[], fallback: T, options: BestEmoteOptions = {}): Promise<Emote | T> {
		const channelData = options.channel ?? this.channel;
		const platformData = options.platform ?? this.platform;
		if (channelData) {
			return await channelData.getBestAvailableEmote(emotes, fallback, options);
		}
		else {
			return await platformData.getBestAvailableEmote(null, emotes, fallback, options);
		}
	}

	async randomEmote <T extends string> (...inputEmotes: T[]): Promise<T> {
		if (inputEmotes.length < 2) {
			throw new SupiError({
				message: "At least two emotes are required"
			});
		}

		const emotes = inputEmotes.slice(0, -1);
		const fallback = inputEmotes.at(-1) as T; // Guaranteed because of the above condition checking for length >= 2

		return await this.getBestAvailableEmote(emotes, fallback, {
			shuffle: true,
			returnEmoteObject: false
		}) as T;
	}

	get tee () { return this.append.tee; }
}

export interface CommandDefinition extends TemplateDefinition {
	Name: Command["Name"];
	Aliases: Command["Aliases"] | null;
	Description: Command["Description"];
	Cooldown: Command["Cooldown"];
	Flags: Command["Flags"];
	Params: Command["Params"] | null;
	Whitelist_Response: Command["Whitelist_Response"];
	Code: Command["Code"];
	Dynamic_Description: Command["Dynamic_Description"];

	initialize?: CustomInitFunction;
	destroy?: CustomDestroyFunction;
}
export type ExecuteFunction = (this: Command, context: Context, ...args: string[]) => StrictResult | Promise<StrictResult>;
export type DescriptionFunction = (this: Command, prefix: string) => string[] | Promise<string[]>;
export type CustomInitFunction = (this: Command) => Promise<void> | void;
export type CustomDestroyFunction = (this: Command) => void;

type ExecuteOptions = {
	skipPending?: boolean;
	privateMessage?: boolean;
	skipBanphrases?: boolean;
	skipGlobalBan?: boolean;
	skipMention?: boolean;
	partialExecute?: boolean;
	context?: Context;
};

type CooldownObject = {
	length?: number | null;
	channel?: Channel["ID"] | null,
	user?: User["ID"] | null;
	command?: Command["Name"];
	ignoreCooldownFilters?: boolean;
};
type CooldownDefinition = number | null | CooldownObject;

export class Command extends TemplateWithoutId {
	readonly Name: string;
	readonly Aliases: string[];
	readonly Description: string | null;
	readonly Cooldown: number | null;
	readonly Flags: Readonly<Flag[]>;
	readonly Params: ParameterDefinitions = [];
	readonly Whitelist_Response: string | null;
	readonly Code: ExecuteFunction;
	readonly Dynamic_Description: DescriptionFunction | null;

	#ready = false;
	#destroyed = false;
	readonly #customDestroy: CustomDestroyFunction | null;
	readonly data = {};

	static readonly importable = true;
	static readonly uniqueIdentifier = "Name";
	static data: Map<Command["Name"], Command> = new Map();

	static readonly #cooldownManager = new CooldownManager();
	static readonly privilegedCommandCharacters = ["$"];
	static readonly ignoreParametersDelimiter = "--";

	static #prefixRegex: RegExp | null = null;

	constructor (data: CommandDefinition) {
		super();

		this.Name = data.Name;
		this.Aliases = data.Aliases ?? [];
		this.Description = data.Description ?? null;
		this.Cooldown = data.Cooldown ?? null;
		this.Whitelist_Response = data.Whitelist_Response ?? null;

		this.Flags = Object.freeze(data.Flags);
		this.Params = data.Params ?? [];

		this.Code = data.Code;
		this.Dynamic_Description = data.Dynamic_Description ?? null;

		if (typeof data.initialize === "function") {
			try {
				const result = data.initialize.call(this);
				if (result instanceof Promise) {
					result
						.then(() => { this.#ready = true; })
						.catch(() => { this.#ready = false; });
				}
				else {
					this.#ready = true;
				}
			}
			catch (e) {
				console.warn("Custom command initialization failed", { command: this.Name, error: e });
			}
		}
		else {
			this.#ready = true;
		}

		this.#customDestroy = data.destroy ?? null;
	}

	destroy () {
		if (typeof this.#customDestroy === "function") {
			try {
				this.#customDestroy();
			}
			catch (e) {
				console.warn("Custom command destroy method failed", { command: this.Name, error: e });
			}
		}

		this.#destroyed = true;
	}

	async execute (context: Context, ...args: string[]): Promise<StrictResult> {
		if (!this.#ready) {
			console.warn("Attempt to run not yet initialized command", this.Name);
			return { success: false, reply: null };
		}
		else if (this.#destroyed) {
			console.warn("Attempt to run destroyed command", this.Name);
			return { success: false, reply: null };
		}

		return await this.Code(context, ...args);
	}

	async getDynamicDescription () {
		if (!this.Dynamic_Description) {
			return null;
		}
		else {
			return await this.Dynamic_Description(COMMAND_PREFIX);
		}
	}

	getDetailURL (options: { useCodePath?: boolean } = {}) {
		if (options.useCodePath) {
			const baseURL = config.values.commandCodeUrlPrefix;
			if (!baseURL) {
				return "N/A";
			}

			return `${baseURL}/${encodeURIComponent(this.Name)}/index.js`;
		}
		else {
			const baseURL = config.values.commandDetailUrlPrefix;
			if (!baseURL) {
				return "N/A";
			}

			return `${baseURL}/${encodeURIComponent(this.Name)}`;
		}
	}

	getCacheKey () {
		return `sb-command-${this.Name}`;
	}

	registerMetric (type: MetricType, label: string, options: Partial<MetricConfiguration<string>>) {
		const metricLabel = `supibot_command_${this.Name}_${label}`;
		const metricOptions = {
			...options,
			help: options.help ?? "Unnamed command metric",
			name: metricLabel
		};

		return core.Metrics.register(type, metricOptions);
	}

	static initialize () {
		core.Metrics.registerCounter({
			name: "supibot_command_executions_total",
			help: "The total number of command executions.",
			labelNames: ["name", "result", "reason"]
		});

		return Promise.resolve();
	}

	static importData (definitions: CommandDefinition[]) {
		for (const definition of definitions) {
			const instance = new Command(definition);
			this.data.set(definition.Name, instance);
		}

		this.validate();
	}

	static importSpecific (...definitions: CommandDefinition[]) {
		if (definitions.length === 0) {
			return [];
		}

		const addedInstances = [];
		for (const definition of definitions) {
			const commandName = definition.Name;
			const previousInstance = Command.get(commandName);
			if (previousInstance) {
				Command.data.delete(commandName);
				previousInstance.destroy();
			}

			const currentInstance = new Command(definition);
			Command.data.set(commandName, currentInstance);
			addedInstances.push(currentInstance);
		}

		this.validate();
		return addedInstances;
	}

	static validate () {
		if (Command.data.size === 0) {
			console.warn("No commands initialized - bot will not respond to any command queries");
		}
		if (!Command.prefix) {
			console.warn("No command prefix configured - bot will not respond to any command queries");
		}

		const names = [];
		for (const command of Command.data.values()) {
			names.push(command.Name, ...command.Aliases);
		}

		const uniqueNames = new Set(names);
		if (uniqueNames.size !== names.length) {
			const duplicates = names.filter((i, ind, arr) => arr.indexOf(i) !== ind);
			console.warn("Duplicate command names detected!", { duplicates });
		}
	}

	static get (identifier: Command | string): Command | null {
		if (identifier instanceof Command) {
			return identifier;
		}
		else if (Command.data.has(identifier)) {
			return Command.data.get(identifier) as Command; // Type cast due to above condition
		}
		else {
			for (const command of Command.data.values()) {
				if (command.Aliases.includes(identifier)) {
					return command;
				}
			}

			return null;
		}
	}

	static async checkAndExecute (data: {
		  command: string, // @todo consider renaming `command` to `invocation` here
		  args: string[],
		  user: User,
		  channel: Channel | null,
		  platform: Platform,
		  options: ExecuteOptions,
		  platformSpecificData: ContextPlatformSpecificData
	}): Promise<Result> {
		let { command: identifier } = data;
		const {
			args: argumentArray,
			channel: channelData,
			user: userData,
			platform: platformData,
			options,
			platformSpecificData = null
		} = data;

		if (!identifier) {
			return { success: false, reason: "no-identifier" };
		}

		if (channelData?.Mode === "Inactive" || channelData?.Mode === "Read") {
			return {
				success: false,
				reason: `channel-${channelData.Mode.toLowerCase()}`
			};
		}

		// Special parsing of privileged characters - they can be joined with other characters, and still be usable
		// as a separate command.
		if (Command.privilegedCommandCharacters.length > 0) {
			for (const char of Command.privilegedCommandCharacters) {
				if (identifier.startsWith(char)) {
					argumentArray.unshift(identifier.replace(char, ""));
					identifier = char;
					break;
				}
			}
		}

		const command = Command.get(identifier);
		if (!command) {
			return { success: false, reason: "no-command" };
		}

		const metric = core.Metrics.get("supibot_command_executions_total") as Counter; // Always defined

		// Check for cooldowns, return if it did not pass yet.
		// If skipPending flag is set, do not check for pending status.
		const channelID: number | symbol = (channelData?.ID ?? privateMessageChannelSymbol);
		const cooldownCheck = Command.#cooldownManager.check(
			channelID,
			userData.ID,
			command.Name,
			Boolean(options.skipPending)
		);

		if (!cooldownCheck) {
			if (!options.skipPending) {
				const pending = Command.#cooldownManager.fetchPending(userData.ID);
				if (pending) {
					return {
						reply: (options.privateMessage) ? pending.description : null,
						reason: "pending"
					};
				}
			}

			return { success: false, reason: "cooldown" };
		}

		// If skipPending flag is set, do not set the pending status at all.
		// Used in pipe command, for instance.
		// Administrators are not affected by Pending - this is expected to be used for debugging.
		const isAdmin = await userData.getDataProperty("administrator") as boolean;

		if (!options.skipPending && !isAdmin) {
			const sourceName = channelData?.Name ?? `${platformData.name} PMs`;
			Command.#cooldownManager.setPending(
				userData.ID,
				`You have a pending command: "${identifier}" used in "${sourceName}" at ${new SupiDate().sqlDateTime()}`
			);
		}

		const appendOptions: ContextAppendData = { ...options };
		const isPrivateMessage = (!channelData);

		const contextOptions: ContextData = {
			platform: platformData,
			invocation: identifier,
			user: userData,
			channel: channelData,
			transaction: null,
			privateMessage: isPrivateMessage,
			append: appendOptions,
			platformSpecificData,
			params: {}
		};

		let args = argumentArray
			.map(i => i.replace(whitespaceRegex, ""))
			.filter(Boolean);

		// If the command is rollback-able, set up a transaction.
		// The command must use the connection in transaction - that's why it is passed to context
		if (command.Flags.includes("rollback")) {
			contextOptions.transaction = await core.Query.getTransaction();
		}

		let failedParamsParseResult;
		if (command.Params.length > 0) {
			const result = Command.parseParametersFromArguments(command.Params, args);

			// Don't exit immediately, save the result and check filters first
			if (!result.success) {
				failedParamsParseResult = result;
			}
			else {
				args = result.args;
				contextOptions.params = result.parameters as ParamFromDefinition<typeof command.Params>;
			}
		}

		const filterData = await Filter.execute({
			user: userData,
			command,
			invocation: identifier,
			channel: channelData ?? null,
			platform: channelData?.Platform ?? null,
			targetUser: args[0] ?? null,
			args
		});

		const isFilterGlobalBan = Boolean(
			!filterData.success
			&& filterData.reason === "blacklist"
			&& filterData.filter.Active
			&& filterData.filter.User_Alias !== null
			&& filterData.filter.Channel === null
			&& filterData.filter.Platform === null
			&& filterData.filter.Command === null
			&& filterData.filter.Invocation === null
		);

		if (!filterData.success && (!options.skipGlobalBan || !isFilterGlobalBan)) {
			Command.#cooldownManager.unsetPending(userData.ID);

			let length = command.Cooldown;
			const cooldownFilter = Filter.getCooldownModifiers({
				platform: channelData?.Platform ?? null,
				channel: channelData,
				command,
				invocation: identifier,
				user: userData
			});

			if (cooldownFilter) {
				length = cooldownFilter.applyData(length);
			}

			if (length !== null) {
				Command.#cooldownManager.set(channelID, userData.ID, command.Name, length);
			}

			const { filter, reply } = filterData;
			if (filter instanceof Filter && filter.Response === "Reason" && reply !== null) {
				const { string } = await Banphrase.execute(reply, channelData);
				filterData.reply = string;
			}

			metric.inc({
				name: command.Name,
				result: "filtered",
				reason: filterData.reason
			});

			return filterData;
		}

		// If params parsing failed, filters were checked and none applied, return the failure result now
		if (failedParamsParseResult) {
			Command.#cooldownManager.unsetPending(userData.ID);
			return failedParamsParseResult;
		}

		let execution: Result;
		const context = options.context ?? new Context(command, contextOptions);

		try {
			const start = process.hrtime.bigint();
			const commandExecution: StrictResult = await command.execute(context, ...args);
			const end = process.hrtime.bigint();

			let result: string | null = null;
			if (commandExecution.reply) {
				result = commandExecution.reply.trim().slice(0, 300);
			}
			else if (commandExecution.partialReplies) {
				result = commandExecution.partialReplies
					.map(i => i.message)
					.join(" ")
					.trim()
					.slice(0, 300);
			}

			metric.inc({
				name: command.Name,
				result: (commandExecution.success === false) ? "fail" : "success"
			});

			sb.Logger.logCommandExecution({
				User_Alias: userData.ID,
				Command: command.Name,
				Platform: platformData.ID,
				Executed: new SupiDate(),
				Channel: channelData?.ID ?? null,
				Success: true,
				Invocation: identifier,
				Arguments: JSON.stringify(args.filter(Boolean)),
				Result: result,
				Execution_Time: core.Utils.round(Number(end - start) / 1_000_000, 3)
			});

			execution = commandExecution;
		}
		catch (e) {
			if (!(e instanceof Error)) {
				throw new SupiError({
					message: "Invalid throw value - must be Error"
				});
			}

			metric.inc({
				name: command.Name,
				result: "error"
			});

			sb.Logger.logCommandExecution({
				User_Alias: userData.ID,
				Command: command.Name,
				Platform: platformData.ID,
				Executed: new SupiDate(),
				Channel: channelData?.ID ?? null,
				Success: false,
				Invocation: identifier,
				Arguments: JSON.stringify(args.filter(Boolean)),
				Result: e.message,
				Execution_Time: null
			});

			let origin: "Internal" | "External" = "Internal";
			let errorContext: Record<string, string> = {};
			const loggingContext = {
				user: userData.ID,
				command: command.Name,
				invocation: identifier,
				channel: channelData?.ID ?? null,
				Platform: platformData.ID,
				params: context.params,
				isPrivateMessage
			};

			if (isGenericRequestError(e)) {
				origin = "External";
				const { hostname, statusCode, statusMessage } = e.args as Record<string, string>;
				errorContext = {
					type: "Command request error",
					hostname,
					message: e.simpleMessage,
					statusCode,
					statusMessage
				};
			}
			else if (isGotRequestError(e)) {
				origin = "External";
				const { code, name, message, options } = e;
				errorContext = {
					type: "GotError",
					code,
					message,
					name,
					url: options.url?.toString() ?? "(N/A)"
				};
			}

			const errorID = await sb.Logger.logError("Command", e, {
				origin,
				context: {
					identifier,
					error: errorContext,
					command: loggingContext
				},
				arguments: args
			});

			if (isGenericRequestError(e)) {
				const { hostname } = errorContext;
				execution = {
					success: false,
					reason: "generic-request-error",
					reply: `Third party service ${hostname} failed! 🚨 (ID ${errorID})`
				};
			}
			else if (isGotRequestError(e)) {
				execution = {
					success: false,
					reason: "got-error",
					reply: `Third party service failed! 🚨 (ID ${errorID})`
				};
			}
			else {
				const channelHasFullErrorMessage = await channelData?.getDataProperty("showFullCommandErrorMessage");
				const reply = (channelHasFullErrorMessage)
					? `Error ID ${errorID} - ${e.message}`
					: config.responses.commandErrorResponse;

				execution = {
					success: false,
					reason: "error",
					reply
				};
			}
		}

		// unset pending cooldown, before anything else - even read-only commands should unset it (despite not
		// having any cooldown themselves)
		Command.#cooldownManager.unsetPending(userData.ID);

		// Read-only commands never reply with anything - banphrases, mentions and cooldowns are not checked
		if (command.Flags.includes("read-only")) {
			return {
				success: execution.success ?? true
			};
		}

		Command.handleCooldown(channelData, userData, command, execution.cooldown, identifier);

		if (typeof execution.reply !== "string" && !execution.partialReplies) {
			return execution;
		}

		if (Array.isArray(execution.partialReplies)) {
			const partResult = [];
			for (const { message, bancheck } of execution.partialReplies) {
				if (bancheck) {
					const { string } = await Banphrase.execute(
						message,
						channelData
					);

					partResult.push(string);
				}
				else {
					partResult.push(message);
				}
			}

			execution.reply = partResult.join(" ");
		}

		execution.reply = String(execution.reply).trim();

		if (execution.reply.length === 0) {
			execution.reply = "(empty message)";
		}

		const metaSkip = Boolean(!execution.partialReplies && (options.skipBanphrases || execution.meta?.skipBanphrases));
		if (!command.Flags.includes("skip-banphrase") && !metaSkip) {
			let messageSlice = execution.reply.slice(0, 2000);
			if (!execution.meta?.skipWhitespaceCheck) {
				messageSlice = messageSlice.replace(whitespaceRegex, "");
			}

			const isPrivateReply = (execution.replyWithPrivateMessage === true);
			const channelTarget = (isPrivateReply) ? null : channelData;

			const banphraseResult = await Banphrase.execute(messageSlice, channelTarget);
			const { passed, string } = banphraseResult;

			execution.reply = string;

			const hasPrivateFlag = (typeof execution.replyWithPrivateMessage === "boolean");
			if (banphraseResult.passed && !hasPrivateFlag && typeof banphraseResult.privateMessage === "boolean") {
				execution.replyWithPrivateMessage = banphraseResult.privateMessage;
			}

			if (command.Flags.includes("rollback") && context.transaction) {
				if (passed) {
					await context.transaction.commit();
				}
				else {
					await context.transaction.rollback();
				}

				await context.transaction.end();
			}
		}
		else if (command.Flags.includes("rollback") && context.transaction) {
			await context.transaction.commit();
			await context.transaction.end();
		}

		// Apply all unpings to the result, if it is still a string (aka the response should be sent)
		if (typeof execution.reply === "string") {
			execution.reply = await Filter.applyUnping({
				command,
				invocation: identifier,
				channel: channelData ?? null,
				platform: channelData?.Platform ?? null,
				string: execution.reply,
				executor: userData
			});
		}

		const mentionUser = Boolean(
			!options.skipMention
			&& command.Flags.includes("mention")
			&& channelData?.Mention
			&& Filter.getMentionStatus({
				user: userData,
				command,
				channel: channelData,
				platform: channelData.Platform
			})
		);

		if (mentionUser) {
			const { string } = await Banphrase.execute(
				userData.Name,
				channelData
			);

			execution.reply = `${string}, ${execution.reply}`;
		}

		// If the `hasPrefix` condition is met (we want the external prefix to be added), we check two more conditions:
		// a) Either the command succeeded and the prefix isn't skipped, or
		// b) The prefix is forced no matter the command's success status.
		// The "channel alias" prefix takes precedence before teh "external input" one.
		const hasPrefix = Boolean(!options.partialExecute && execution.hasExternalInput);
		if (execution.isChannelAlias) {
			execution.reply = `#⃣  ${execution.reply}`;
		}
		else if (hasPrefix && ((execution.success !== false && !execution.skipExternalPrefix) || execution.forceExternalPrefix)) {
			execution.reply = `👥 ${execution.reply}`;
		}

		return execution;
	}

	static handleCooldown (channelData: Channel | null, userData: User, commandData: Command, cooldownData: CooldownDefinition | undefined, identifier: Invocation) {
		// Take care of private messages, where channel === null
		const channelID = channelData?.ID ?? privateMessageChannelSymbol;

		if (typeof cooldownData !== "undefined") {
			if (cooldownData !== null) {
				const cooldown: CooldownObject = (typeof cooldownData === "number")
					? { length: cooldownData }
					: cooldownData;

				let length = cooldown.length ?? 0;
				const {
					channel = channelID,
					user = userData.ID,
					command = commandData.Name,
					ignoreCooldownFilters = false
				} = cooldown;

				if (!ignoreCooldownFilters) {
					const cooldownFilter = Filter.getCooldownModifiers({
						platform: channelData?.Platform ?? null,
						channel: channelData,
						command: commandData,
						invocation: identifier,
						user: userData
					});

					if (cooldownFilter) {
						const filterResult = cooldownFilter.applyData(length);
						if (filterResult !== null) {
							length = filterResult;
						}
					}
				}

				Command.#cooldownManager.set(channel, user, command, length);
			}
			else {
				// If cooldownData === null, no cooldown is set at all.
			}
		}
		else {
			let length = commandData.Cooldown ?? 0;
			const cooldownFilter = Filter.getCooldownModifiers({
				platform: channelData?.Platform ?? null,
				channel: channelData,
				command: commandData,
				invocation: identifier,
				user: userData
			});

			if (cooldownFilter) {
				const filterResult = cooldownFilter.applyData(length);
				if (filterResult !== null) {
					length = filterResult;
				}
			}

			Command.#cooldownManager.set(channelID, userData.ID, commandData.Name, length);
		}
	}

	static extractMetaResultProperties (execution: Result): Record<string, boolean> {
		const result: Record<string, boolean> = {};
		for (const [key, value] of Object.entries(execution)) {
			if (typeof value === "boolean") {
				result[key] = value;
			}
		}

		return result;
	}

	/**
	 * Parses a string value into a proper parameter type value, as signified by the `type` argument.
	 * Returns `null` if the value provided is somehow invalid (e.g. non-finite Number, invalid Date or RegExp)
	 */
	static parseParameter (value: string, type: ParameterType, explicit?: boolean): ParameterValue | null {
		// Empty implicit string value is always invalid, since that is written as `$command param:` which is a typo/mistake
		if (type === "string" && !explicit && value === "") {
			return null;
		}
		// Non-string parameters are also always invalid with empty string value, regardless of implicitness
		else if (type !== "string" && value === "") {
			return null;
		}

		switch (type) {
			case "string": return String(value);

			case "number": {
				const output = Number(value);
				if (!Number.isFinite(output)) {
					return null;
				}

				return output;
			}

			case "boolean": {
				if (value === "true") {
					return true;
				}
				else if (value === "false") {
					return false;
				}

				break;
			}

			case "date": {
				const date = new SupiDate(value);
				if (Number.isNaN(date.valueOf())) {
					return null;
				}

				return date;
			}

			case "object": {
				const [key, outputValue] = value.split("=");
				return { key, value: outputValue };
			}

			case "regex": {
				const regex = core.Utils.parseRegExp(value);
				if (!regex) {
					return null;
				}

				// Make sure user input regexes are executable in linear time and therefore are not evil.
				// Only executed if the V8 flag is passed to Node.
				if (process.execArgv.includes(LINEAR_REGEX_FLAG)) {
					let linearRegex;
					try {
						let source = regex.source;
						let flags = regex.flags;

						// Since the "i" flag makes the regex not execute in linear time, use a hacky solution to
						// replace all characters with a group that contains both cases. Then, also remove the "i" flag.
						if (regex.flags.includes("i")) {
							source = source.replaceAll(/(?<!\\)([a-z])/ig, (_total: string, match: string) => `[${match.toLowerCase()}${match.toUpperCase()}]`);
							flags = flags.replace("i", "");
						}

						// Force the "linear" regex flag
						linearRegex = new RegExp(source, `${flags}l`);
					}
					catch {
						return null;
					}

					return linearRegex;
				}
				else {
					return regex;
				}
			}

			case "language": {
				return getLanguage(value);
			}
		}

		return null;
	}

	static createFakeContext (command: Command, contextData: ContextData): Context {
		const data = {
			user: contextData.user,
			platform: contextData.platform,
			invocation: contextData.invocation ?? command.Name,
			channel: contextData.channel ?? null,
			transaction: contextData.transaction ?? null,
			privateMessage: contextData.privateMessage ?? false,
			append: contextData.append ?? {},
			params: contextData.params ?? {},
			platformSpecificData: contextData.platformSpecificData ?? null
		};

		return new Context(command, data);
	}

	static #parseAndAppendParameter (
		value: string,
		parameterDefinition: ParameterDefinitions[number],
		explicit: boolean,
		existingParameters: AppendedParameters
	): { success: true; newParameters: AppendedParameters; } | ResultFailure {
		const parameters: AppendedParameters = { ...existingParameters };
		const parsedValue = Command.parseParameter(value, parameterDefinition.type, explicit);
		if (parsedValue === null) {
			return {
				success: false,
				reply: `Could not parse parameter "${parameterDefinition.name}"!`
			};
		}
		else if (parameterDefinition.type === "object") {
			// Known type because of (parameterDefinition.type === "object")
			const { key, value } = parsedValue as ParameterValueMap["object"];

			parameters[parameterDefinition.name] ??= {};

			// Known type because of above setup
			const obj = parameters[parameterDefinition.name] as Record<string, string>;

			// Refuse to override an already existing value
			if (typeof obj[key] !== "undefined") {
				return {
					success: false,
					reply: `Cannot use multiple values for parameter "${parameterDefinition.name}", key ${key}!`
				};
			}

			obj[key] = value;
		}
		else {
			parameters[parameterDefinition.name] = parsedValue;
		}

		return {
			success: true,
			newParameters: parameters
		};
	}

	static parseParametersFromArguments (
		paramsDefinition: ParameterDefinitions,
		argsArray: string[]
	): { success: true; parameters: Record<string, ParameterValue>; args: string[]; } | ResultFailure {
		const argsStr = argsArray.join(" ");
		const outputArguments: string[] = [];
		let parameters: Record<string, ParameterValue> = {};

		// Buffer used to store read characters before we know what to do with them
		let buffer = "";
		// Parameter definition of the current parameter
		let currentParam: ParameterDefinition | null = null;
		// is true if currently reading inside the parameter
		let insideParam = false;
		// is true if the current param started using quotes
		let quotedParam = false;

		for (let i = 0; i < argsStr.length; i++) {
			const char = argsStr[i];
			buffer += char;

			if (!insideParam) {
				if (buffer.slice(0, -1) === Command.ignoreParametersDelimiter && char === " ") {
					// Delimiter means all arguments after this point will be ignored, and just passed as-is
					outputArguments.push(...argsStr.slice(i + 1).split(" "));
					return {
						success: true,
						parameters,
						args: outputArguments
					};
				}

				if (char === ":") {
					currentParam = paramsDefinition.find(i => i.name === buffer.slice(0,-1)) ?? null;
					if (currentParam) {
						insideParam = true;
						buffer = "";
						if (argsStr[i + 1] === "\"") {
							i++;
							quotedParam = true;
						}
					}
				}
				else if (char === " ") {
					const sliced = buffer.slice(0, -1);
					if (sliced.length > 0) {
						outputArguments.push(sliced);
					}
					buffer = "";
				}
			}

			if (insideParam) {
				if (currentParam && !quotedParam && char === " ") {
					// end of unquoted param
					const value = Command.#parseAndAppendParameter(buffer.slice(0, -1), currentParam, quotedParam, parameters);
					if (!value.success) {
						return value;
					}
					buffer = "";
					parameters = value.newParameters;
					insideParam = false;
					quotedParam = false;
					currentParam = null;
				}

				if (quotedParam && char === "\"") {
					if (buffer.at(-2) === "\\") {
						// remove the backslash, and add quote
						buffer = `${buffer.slice(0, -2)}"`;
					}
					else if (currentParam) {
						// end of quoted param
						const value = Command.#parseAndAppendParameter(buffer.slice(0, -1), currentParam, quotedParam, parameters);
						if (!value.success) {
							return value;
						}
						buffer = "";
						parameters = value.newParameters;
						insideParam = false;
						quotedParam = false;
						currentParam = null;
					}
				}
			}
		}

		// Handle the buffer after all characters are read
		if (insideParam) {
			if (quotedParam) {
				return {
					success: false,
					reply: `Unclosed quoted parameter "${currentParam?.name ?? "(N/A)"}"!`
				};
			}
			else if (currentParam) {
				const value = Command.#parseAndAppendParameter(buffer, currentParam, quotedParam, parameters);
				if (!value.success) {
					return value;
				}
				parameters = value.newParameters;
			}
		}
		else if (buffer !== "" && buffer !== Command.ignoreParametersDelimiter) {
			// Ignore the last parameter if it's the delimiter
			outputArguments.push(buffer);
		}

		return {
			success: true,
			parameters,
			args: outputArguments
		};
	}

	static is (string: string) {
		const prefix = Command.prefix;
		return (string.startsWith(prefix) && string.trim().length > prefix.length);
	}

	static destroy () {
		for (const command of Command.data.values()) {
			command.destroy();
		}
	}

	static get prefixRegex () {
		if (Command.#prefixRegex) {
			return Command.#prefixRegex;
		}

		const prefix = Command.prefix;
		const body = prefix.split("").map(char => (/\w/.test(char))
			? char
			: `\\${char}`
		).join("");

		Command.#prefixRegex = new RegExp(`^${body}`);
		return Command.#prefixRegex;
	}

	static get prefix () {
		return COMMAND_PREFIX;
	}
}
