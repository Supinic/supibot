import { SupiDate, SupiError, isGenericRequestError, isGotRequestError,  } from "supi-core"
import type { Query, MetricConfiguration, MetricType, StringMetricType } from "supi-core";

import { TemplateWithoutId, TemplateDefinition } from "./template.js";

import Banphrase from "./banphrase.js";
import Filter from "./filter.js";
import User from "./user.js";
import { Channel, privateMessageChannelSymbol } from "./channel.js";
import Platform from "../platforms/template.js";
import CooldownManager from "../utils/cooldown-manager.js";
import { Language, LanguageParser } from "../utils/languages.js";

import { whitespaceRegex } from "../utils/regexes.js";
import config from "../config.json" with { type: "json" };

const COMMAND_PREFIX = config.modules.commands.prefix;
const LINEAR_REGEX_FLAG = "--enable-experimental-regexp-engine";

// @todo move to Filter
type FilterExecuteSuccess = {
	success: true;
}
type FilterExecuteFailure = {
	success: false;
	reason: string;
	filter: Filter;
	reply: string | null;
};
type FilterExecuteResult = FilterExecuteSuccess | FilterExecuteFailure;

type QueryTransaction = Awaited<ReturnType<Query["getTransaction"]>>;

type ParameterValueMap = {
	string: string;
	number: number;
	boolean: boolean;
	date: SupiDate;
	object: { key: string; value: string; };
	regex: RegExp;
	language: Language;
};
type ParameterType = keyof ParameterValueMap;
type ParameterValue = ParameterValueMap[ParameterType];
export type ParameterDefinition = {
	name: string;
	type: ParameterType;
};

type ParamFromDefinition<T extends readonly ParameterDefinition[]> = {
	[P in T[number] as P["name"]]: ParameterValueMap[P["type"]];
};

type AppendedParameters = Record<string, string | number | boolean | SupiDate | RegExp | Language | Record<string, string>>;
type ResultFailure = { success: false; reply: string; };

type StrictResult = {
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
};

export type Invocation = string;
export type ContextData<T extends ParameterDefinition[] = ParameterDefinition[]> = {
	user: Context<T>["user"]
	invocation?: Context<T>["invocation"];
	channel?: Context<T>["channel"];
	platform?: Context<T>["platform"];
	transaction?: Context<T>["transaction"];
	privateMessage?: Context<T>["privateMessage"];
	append?: Context<T>["append"];
	params?: Context<T>["params"];
};
export type ContextAppendData = {
	tee?: Invocation[];
	pipe?: boolean;
	aliasCount?: number;
	commandList?: Command["Name"][];
	aliasStack?: Array<Command["Name"] | Command["Aliases"][number]>;
	flags?: unknown;
	id?: string;
	messageID?: string;
	badges?: unknown;
	emotes?: unknown;
	skipPending?: boolean;
	privateMessage?: boolean;
};

type PermissionOptions = Pick<ContextData, "user" | "channel" | "platform">;
type EmoteOptions = { // @todo move to Channel
	shuffle?: boolean;
	caseSensitivity?: boolean;
	filter?: (emote: string) => boolean;
};
type BestEmoteOptions = Pick<ContextData, "channel" | "platform"> & EmoteOptions;

export class Context<T extends ParameterDefinition[] = ParameterDefinition[]> {
	readonly command: Command;
	readonly invocation: string | null;
	readonly user: User | null;
	readonly channel: Channel | null;
	readonly platform: Platform | null;
	readonly transaction: QueryTransaction | null;
	readonly privateMessage: boolean;
	readonly append: ContextAppendData;
	readonly params: ParamFromDefinition<T>;

	readonly meta: Map<string, unknown> = new Map();
	readonly #userFlags: Record<string, boolean>;

	constructor (command: Command, data: ContextData<T> = {}) {
		this.command = command;
		this.invocation = data.invocation ?? null;
		this.user = data.user ?? null;
		this.channel = data.channel ?? null;
		this.platform = data.platform ?? null;
		this.transaction = data.transaction ?? null;
		this.privateMessage = data.privateMessage ?? false;

		this.append = data.append ?? { tee: [] };
		this.append.tee ??= [];

		this.params = (data.params ?? {}) as ParamFromDefinition<T>;

		this.#userFlags = Filter.getFlags({
			command,
			invocation: this.invocation,
			platform: this.platform,
			channel: this.channel,
			user: this.user
		}) as Record<string, boolean>; // @todo remove type-cast after Filter is refactored to TS
	}

	getMeta (name: string) { return this.meta.get(name); }
	setMeta (name: string, value: unknown) { this.meta.set(name, value); }

	getMentionStatus (): boolean {
		if (!this.user) {
			throw new SupiError({
				message: "Cannot get the mention status of Context without User"
			});
		}

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
				this.channel.mirror(string)
			]);
		}
		else if (this.platform && this.user) {
			await this.platform.pm(string, this.user.Name);
		}
		else {
			throw new SupiError({
				message: "Cannot send intermediate message - missing channel, platform and user"
			});
		}
	}

	async getUserPermissions (options: PermissionOptions = {}) {
		const userData = options.user ?? this.user;
		const channelData = options.channel ?? this.channel;
		const platformData = options.platform ?? this.platform;

		const data = await Promise.all([
			userData?.getDataProperty("administrator"),
			platformData?.isUserChannelOwner(channelData, userData),
			channelData?.isUserAmbassador(userData)
		]);

		const flags = {
			administrator: (data[0] === true),
			channelOwner: Boolean(data[1]),
			ambassador: Boolean(data[2])
		};

		let flag = User.permissions.regular;
		if (flags.administrator) {
			flag |= User.permissions.administrator;
		}
		if (flags.channelOwner) {
			flag |= User.permissions.channelOwner;
		}
		if (flags.ambassador) {
			flag |= User.permissions.ambassador;
		}

		return {
			flag,
			is: (type: keyof typeof User.permissions): boolean => {
				if (!User.permissions[type]) {
					throw new sb.Error({
						message: "Invalid user permission type provided"
					});
				}

				return ((flag & User.permissions[type]) !== 0);
			}
		};
	}

	async getBestAvailableEmote (emotes: string[], fallback: string, options: BestEmoteOptions = {}) {
		const channelData = options.channel ?? this.channel;
		const platformData = options.platform ?? this.platform;
		if (channelData) {
			return await channelData.getBestAvailableEmote(emotes, fallback, options);
		}
		else if (platformData) {
			return await platformData.getBestAvailableEmote(null, emotes, fallback, options);
		}

		return "(no emote found)";
	}

	randomEmote <T extends string> (...inputEmotes: T[]): Promise<T> {
		if (inputEmotes.length < 2) {
			throw new sb.Error({
				message: "At least two emotes are required"
			});
		}

		const emotes = inputEmotes.slice(0, -1) as T[];
		const fallback = inputEmotes.at(-1) as T;

		return this.getBestAvailableEmote(emotes, fallback, { shuffle: true });
	}

	get tee () { return this.append.tee; }
}

export interface CommandDefinition extends TemplateDefinition {
	Name: Command["Name"];
	Aliases: Command["Aliases"];
	Description: Command["Description"];
	Cooldown: Command["Cooldown"];
	Flags: Command["Flags"];
	Params: Command["Params"];
	Whitelist_Response: Command["Whitelist_Response"];
	Code: Command["Code"];
	Dynamic_Description: Command["Dynamic_Description"];

	initialize?: InitDestroyFunction;
	destroy?: InitDestroyFunction;
}
export type ExecuteFunction = (this: Command, context: Context, ...args: string[]) => StrictResult | Promise<StrictResult>;
export type DescriptionFunction = (this: Command) => string[] | Promise<string[]>;
export type InitDestroyFunction = (this: Command) => unknown | Promise<unknown>;

type ExecuteOptions<T extends ParameterDefinition[]> = {
	platform: Platform;
	skipPending?: boolean;
	privateMessage?: boolean;
	skipBanphrases?: boolean;
	skipGlobalBan?: boolean;
	skipMention?: boolean;
	partialExecute?: boolean;
	context?: Context;
};

type CooldownObject = {
	length?: number;
	channel?: Channel["ID"],
	user?: User["ID"]
	command?: Command["Name"];
	ignoreCooldownFilters?: boolean;
};
type CooldownDefinition = number | null | CooldownObject;

export class Command extends TemplateWithoutId {
	Name: string;
	Aliases: string[] = [];
	Description: string | null = null;
	Cooldown: number | null;
	Flags: Readonly<string[]>;
	Params: ParameterDefinition[] = [];
	Whitelist_Response: string | null = null;
	Code: ExecuteFunction<T>;
	Dynamic_Description: DescriptionFunction | null;

	#ready = false;
	#destroyed = false;
	#customDestroy: InitDestroyFunction | null;
	data = {};

	static readonly importable = true;
	static readonly uniqueIdentifier = "Name";
	static data: Map<Command["Name"], Command> = new Map();

	static readonly #cooldownManager = new CooldownManager();
	static readonly privilegedCommandCharacters = ["$"];
	static readonly ignoreParametersDelimiter = "--";

	static #prefixRegex: RegExp;

	constructor (data: CommandDefinition) {
		super();

		this.Name = data.Name;
		this.Aliases = [...data.Aliases];
		this.Description = data.Description ?? null;
		this.Cooldown = data.Cooldown ?? null;
		this.Whitelist_Response = data.Whitelist_Response ?? null;

		this.Flags = Object.freeze(data.Flags ?? []);
		this.Params = data.Params ?? [];

		this.Code = data.Code;
		this.Dynamic_Description = data.Dynamic_Description ?? null;

		if (typeof data.initialize === "function") {
			try {
				const result = data.initialize.call(this);
				if (result instanceof Promise) {
					result.then(() => { this.#ready = true; });
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

	async destroy () {
		if (typeof this.#customDestroy === "function") {
			try {
				await this.#customDestroy();
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
			return await this.Dynamic_Description();
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

	registerMetric (type: MetricType | StringMetricType, label: string, options: Partial<MetricConfiguration<string>>) {
		const metricLabel = `supibot_command_${this.Name}_${label}`;
		const metricOptions = {
			...options,
			name: metricLabel
		};

		return sb.Metrics.register(type, metricOptions);
	}

	static async initialize () {
		sb.Metrics.registerCounter({
			name: "supibot_command_executions_total",
			help: "The total number of command executions.",
			labelNames: ["name", "result", "reason"]
		});
	}

	static async importData (definitions: CommandDefinition[]) {
		this.clearData();

		for (const definition of definitions) {
			const instance = new Command(definition);
			this.data.set(definition.Name, instance);
		}

		this.validate();
	}

	static async importSpecific (...definitions: CommandDefinition[]) {
		if (definitions.length === 0) {
			return [];
		}

		const addedInstances = [];
		for (const definition of definitions) {
			const commandName = definition.Name;
			const previousInstance = Command.get(commandName);
			if (previousInstance) {
				Command.data.delete(commandName);
				await previousInstance.destroy();
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
			names.push(command.Name);
			names.push(...command.Aliases);
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

	static async checkAndExecute (
		identifier: string,
		argumentArray: string[],
		channelData: Channel,
		userData: User,
		options: ExecuteOptions
	): Promise<Result> {
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

		const metric = sb.Metrics.get("supibot_command_executions_total");

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
			const sourceName = channelData?.Name ?? `${options.platform.Name} PMs`;
			Command.#cooldownManager.setPending(
				userData.ID,
				`You have a pending command: "${identifier}" used in "${sourceName}" at ${new sb.Date().sqlDateTime()}`
			);
		}

		const appendOptions: Omit<ContextAppendData, "platform"> = { ...options };
		const isPrivateMessage = (!channelData);

		const contextOptions: ContextData = {
			platform: options.platform,
			invocation: identifier,
			user: userData,
			channel: channelData,
			transaction: null,
			privateMessage: isPrivateMessage,
			append: appendOptions,
			params: {}
		};

		let args = argumentArray
			.map(i => i.replace(whitespaceRegex, ""))
			.filter(Boolean);

		// If the command is rollback-able, set up a transaction.
		// The command must use the connection in transaction - that's why it is passed to context
		if (command.Flags.includes("rollback")) {
			contextOptions.transaction = await sb.Query.getTransaction();
		}

		let failedParamsParseResult;
		if (command.Params.length > 0) {
			const result = Command.parseParametersFromArguments(command.Params, args);

			// Don't exit immediately, save the result and check filters first
			// noinspection PointlessBooleanExpressionJS
			if (result.success === false) {
				failedParamsParseResult = result;
			}
			else {
				args = result.args;
				contextOptions.params = result.parameters;
			}
		}

		const filterData: FilterExecuteResult = await Filter.execute({
			user: userData,
			command,
			invocation: identifier,
			channel: channelData ?? null,
			platform: channelData?.Platform ?? null,
			targetUser: args[0] ?? null,
			args: args ?? []
		}) as FilterExecuteResult; /* @todo remove after Filter is in Typescript */

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

			if (filterData.filter.Response === "Reason" && typeof filterData.reply === "string") {
				const { string } = await Banphrase.execute(filterData.reply, channelData);
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
				result: (commandExecution?.success === false) ? "fail" : "success"
			});

			sb.Logger.logCommandExecution({
				User_Alias: userData.ID,
				Command: command.Name,
				Platform: options.platform.ID,
				Executed: new sb.Date(),
				Channel: channelData?.ID ?? null,
				Success: true,
				Invocation: identifier,
				Arguments: JSON.stringify(args.filter(Boolean)),
				Result: result,
				Execution_Time: sb.Utils.round(Number(end - start) / 1_000_000, 3)
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

			let origin = "Internal";
			let errorContext: Record<string, string> = {};
			const loggingContext = {
				user: userData.ID,
				command: command.Name,
				invocation: identifier,
				channel: channelData?.ID ?? null,
				platform: options.platform.ID,
				params: context.params ?? {},
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
		if (command.Flags.includes("readOnly")) {
			return {
				success: execution?.success ?? true
			};
		}

		Command.handleCooldown(channelData, userData, command, execution.cooldown, identifier);

		if (typeof execution.reply !== "string" && !execution.partialReplies) {
			return execution;
		}

		if (Array.isArray(execution.partialReplies)) {
			if (execution.partialReplies.some(i => i && i.constructor !== Object)) {
				throw new sb.Error({
					message: "If set, partialReplies must be an Array of Objects"
				});
			}

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

		const metaSkip = Boolean(!execution.partialReplies && (options.skipBanphrases || execution?.meta?.skipBanphrases));
		if (!command.Flags.includes("skipBanphrase") && !metaSkip) {
			let messageSlice = execution.reply.slice(0, 2000);
			if (!execution.meta?.skipWhitespaceCheck) {
				messageSlice = messageSlice.replace(whitespaceRegex, "");
			}

			const isPrivateReply = (execution.replyWithPrivateMessage === true);
			const channelTarget = (isPrivateReply) ? null : channelData;
			const { passed, privateMessage, string } = await Banphrase.execute(messageSlice, channelTarget);

			execution.reply = string;

			const hasPrivateFlag = (typeof execution.replyWithPrivateMessage === "boolean");
			if (!hasPrivateFlag && typeof privateMessage === "boolean") {
				execution.replyWithPrivateMessage = privateMessage;
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
				channel: channelData ?? null,
				platform: channelData?.Platform ?? null
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

				let { length = 0 } = cooldown;
				const {
					channel = channelID,
					user = userData.ID,
					command = commandData.Name,
					ignoreCooldownFilters = false,
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
						length = cooldownFilter.applyData(length);
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
				length = cooldownFilter.applyData(length);
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
				const regex = sb.Utils.parseRegExp(value);

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
				return LanguageParser.getLanguage(value);
			}
		}

		return null;
	}

	static createFakeContext (command: Command, contextData: ContextData = {}, extraData: ContextAppendData = {}): Context {
		const data = {
			invocation: contextData.invocation ?? command.Name,
			user: contextData.user ?? null,
			channel: contextData.channel ?? null,
			platform: contextData.platform ?? null,
			transaction: contextData.transaction ?? null,
			privateMessage: contextData.privateMessage ?? false,
			append: contextData.append ?? {},
			params: contextData.params ?? {},
			...extraData
		};

		return new Context(command, data);
	}

	static #parseAndAppendParameter (
		value: string,
		parameterDefinition: ParameterDefinition,
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
		paramsDefinition: ParameterDefinition[],
		argsArray: string[]
	): { success: true; parameters: unknown; args: string[]; } | ResultFailure {
		const argsStr = argsArray.join(" ");
		const outputArguments: string[] = [];
		let parameters: AppendedParameters = {};

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
		if (prefix === null) {
			return false;
		}

		return (string.startsWith(prefix) && string.trim().length > prefix.length);
	}

	static destroy () {
		for (const command of Command.data.values()) {
			void command.destroy();
		}
	}

	static get prefixRegex () {
		if (Command.#prefixRegex) {
			return Command.#prefixRegex;
		}

		const prefix = Command.prefix;
		if (!prefix) {
			return null;
		}

		const body = [...prefix].map(char => (/\w/.test(char))
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
