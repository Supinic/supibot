const Banphrase = require("./banphrase.js");
const Filter = require("./filter.js");
const User = require("./user.js");

const pathModule = require("node:path");
const CooldownManager = require("../utils/cooldown-manager.js");
const LanguageCodes = require("language-iso-codes");

const LINEAR_REGEX_FLAG = "--enable-experimental-regexp-engine";

let config;
try {
	config = require("../config.json");
}
catch {
	config = require("../config-default.json");
}

const COMMAND_PREFIX = config.modules.commands.prefix;
class Context {
	#command;
	#invocation;
	#user;
	#channel;
	#platform;
	#transaction = null;
	#privateMessage = false;
	#append = {};
	#params = {};
	#meta = new Map();
	#userFlags = {};

	constructor (command, data = {}) {
		this.#command = command;
		this.#invocation = data.invocation ?? null;
		this.#user = data.user ?? null;
		this.#channel = data.channel ?? null;
		this.#platform = data.platform ?? null;
		this.#transaction = data.transaction ?? null;
		this.#privateMessage = data.privateMessage ?? false;
		this.#append = data.append ?? this.#append;
		this.#params = data.params ?? this.#params;

		this.#append.tee ??= [];

		this.#userFlags = Filter.getFlags({
			command,
			invocation: this.#invocation,
			platform: this.#platform,
			channel: this.#channel,
			user: this.#user
		});
	}

	getMeta (name) { return this.#meta.get(name); }
	setMeta (name, value) { this.#meta.set(name, value); }

	getMentionStatus () {
		return Filter.getMentionStatus({
			user: this.#user,
			command: this.#command,
			channel: this.#channel ?? null,
			platform: this.#platform
		});
	}

	async sendIntermediateMessage (string) {
		if (this.#channel) {
			await Promise.all([
				this.#channel.send(string),
				this.#channel.mirror(string)
			]);
		}
		else {
			await this.#platform.pm(string, this.#user.Name);
		}
	}

	async getUserPermissions (options = {}) {
		const userData = options.user ?? this.#user;
		const channelData = options.channel ?? this.#channel;
		const platformData = options.platform ?? this.#platform;

		const data = await Promise.all([
			userData.getDataProperty("administrator"),
			platformData?.isUserChannelOwner(channelData, userData),
			channelData?.isUserAmbassador(userData)
		]);

		const flags = {
			administrator: (data[0] === true),
			channelOwner: Boolean(data[1]),
			ambassador: Boolean(data[2])
		};

		let flag = User.permissions.regular;
		for (const [key, value] of Object.entries(flags)) {
			if (value) {
				// eslint-disable-next-line no-bitwise
				flag |= User.permissions[key];
			}
		}

		return {
			flag,
			/**
			 * @param {UserPermissionLevel} type
			 * @returns {boolean}
			 */
			is: (type) => {
				if (!User.permissions[type]) {
					throw new sb.Error({
						message: "Invalid user permission type provided"
					});
				}

				// eslint-disable-next-line no-bitwise
				return ((flag & User.permissions[type]) !== 0);
			}
		};
	}

	async getBestAvailableEmote (emotes, fallback, options = {}) {
		const channelData = options.channel ?? this.#channel;
		const platformData = options.platform ?? this.#platform;
		if (channelData) {
			return await channelData.getBestAvailableEmote(emotes, fallback, options);
		}
		else if (platformData) {
			return await platformData.getBestAvailableEmote(null, emotes, fallback, options);
		}

		return "(no emote found)";
	}

	randomEmote (...inputEmotes) {
		if (inputEmotes.length < 2) {
			throw new sb.Error({
				message: "At least two emotes are required"
			});
		}

		const emotes = inputEmotes.slice(0, -1);
		const fallback = inputEmotes.at(-1);

		return this.getBestAvailableEmote(emotes, fallback, { shuffle: true });
	}

	get tee () { return this.#append.tee; }
	get invocation () { return this.#invocation; }
	get user () { return this.#user; }
	get channel () { return this.#channel; }
	get platform () { return this.#platform; }
	get transaction () { return this.#transaction; }
	get privateMessage () { return this.#privateMessage; }
	get append () { return this.#append; }
	get params () { return this.#params; }
	get userFlags () { return this.#userFlags; }
}

class Command extends require("./template.js") {
	Name;
	Aliases = [];
	Description = null;
	Cooldown;
	Flags = {};
	Params = [];
	Whitelist_Response = null;
	Code;
	Dynamic_Description;

	#ready = false;
	#destroyed = false;
	#customDestroy = null;

	#Author;

	data = {};

	static importable = true;
	static uniqueIdentifier = "Name";

	static #privateMessageChannelID = Symbol("private-message-channel");
	static #cooldownManager = new CooldownManager();

	static privilegedCommandCharacters = ["$"];
	static ignoreParametersDelimiter = "--";

	static #prefixRegex;

	constructor (data) {
		super();

		this.Name = data.Name;
		if (typeof this.Name !== "string" || this.Name.length === 0) {
			console.error(`Command ID ${this.ID} has an unusable name`, data.Name);
			this.Name = ""; // just a precaution so that the command never gets found out
		}

		if (data.Aliases === null) {
			this.Aliases = [];
		}
		else if (typeof data.Aliases === "string") {
			try {
				this.Aliases = JSON.parse(data.Aliases);
			}
			catch (e) {
				this.Aliases = [];
				console.warn(`Command has invalid JSON aliases definition`, {
					command: this,
					error: e,
					data
				});
			}
		}
		else if (Array.isArray(data.Aliases) && data.Aliases.every(i => typeof i === "string")) {
			this.Aliases = [...data.Aliases];
		}
		else {
			this.Aliases = [];
			console.warn(`Command has invalid aliases type`, { data });
		}

		this.Description = data.Description;

		this.Cooldown = data.Cooldown;

		if (data.Flags !== null) {
			let flags = data.Flags;
			if (typeof flags === "string") {
				flags = flags.split(",");
			}
			else if (flags.constructor === Object) {
				flags = Object.keys(flags);
			}

			for (const flag of flags) {
				const camelFlag = sb.Utils.convertCase(flag, "kebab", "camel");
				this.Flags[camelFlag] = true;
			}
		}

		if (data.Params !== null) {
			let params = data.Params;
			if (typeof params === "string") {
				try {
					params = JSON.parse(params);
				}
				catch (e) {
					this.Params = null;
					console.warn(`Command has invalid JSON params definition`, {
						commandName: this.Name,
						error: e
					});
				}
			}

			this.Params = params;
		}

		Object.freeze(this.Flags);

		this.Whitelist_Response = data.Whitelist_Response;

		this.#Author = data.Author;

		if (typeof data.Code === "function") {
			this.Code = data.Code;
		}

		if (typeof data.Dynamic_Description === "function") {
			this.Dynamic_Description = data.Dynamic_Description;
		}
		else {
			this.Dynamic_Description = null;
		}

		if (typeof data.initialize === "function") {
			try {
				const result = data.initialize.call(this);

				if (result instanceof Promise) {
					result.then(() => {
						this.#ready = true;
					});
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

		if (typeof data.destroy === "function") {
			this.#customDestroy = data.destroy;
		}
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

		this.Code = null;
		this.data = null;
	}

	execute (...args) {
		if (this.#ready === false) {
			console.warn("Attempt to run not yet initialized command", this.Name);
			return;
		}
		else if (this.#destroyed === true) {
			console.warn("Attempt to run destroyed command", this.Name);
			return;
		}

		return this.Code(...args);
	}

	async getDynamicDescription () {
		if (!this.Dynamic_Description) {
			return null;
		}
		else {
			return await this.Dynamic_Description(Command.prefix);
		}
	}

	getDetailURL (options = {}) {
		if (options.useCodePath) {
			const baseURL = sb.Config.get("COMMAND_DETAIL_CODE_URL", false);
			if (!baseURL) {
				return "N/A";
			}

			return `${baseURL}/${encodeURIComponent(this.Name)}/index.js`;
		}
		else {
			const baseURL = sb.Config.get("COMMAND_DETAIL_URL", false);
			if (!baseURL) {
				return "N/A";
			}

			return `${baseURL}/${encodeURIComponent(this.Name)}`;
		}
	}

	getCacheKey () {
		return `sb-command-${this.Name}`;
	}

	registerMetric (type, label, options = {}) {
		const metricLabel = `supibot_command_${this.Name}_${label}`;
		const metricOptions = {
			...options,
			name: metricLabel
		};

		return sb.Metrics.register(type, metricOptions);
	}

	get Author () { return this.#Author; }

	static async initialize () {
		if (sb.Metrics) {
			sb.Metrics.registerCounter({
				name: "supibot_command_executions_total",
				help: "The total number of command executions.",
				labelNames: ["name", "result", "reason"]
			});
		}

		// Override the default template behaviour of automatically calling `loadData()` by doing nothing.
		// This is new (experimental) behaviour, where the commands' definitions will be loaded externally!
		return this;
	}

	static async importData (definitions) {
		super.importData(definitions);
		await this.validate();
	}

	static async importSpecific (...definitions) {
		super.genericImportSpecific(...definitions);
		await this.validate();
	}

	static invalidateRequireCache (requireBasePath, ...names) {
		return super.genericInvalidateRequireCache({
			names,
			requireBasePath,
			extraDeletionCallback: (path) => {
				const dirPath = pathModule.parse(path).dir;
				const mainFilePath = pathModule.join(dirPath, "index.js");

				return Object.keys(require.cache).filter(filePath => {
					const hasCorrectExtension = (filePath.endsWith(".js") || filePath.endsWith(".json"));
					return (filePath.startsWith(dirPath) && hasCorrectExtension && filePath !== mainFilePath);
				});
			}
		});
	}

	static async validate () {
		if (Command.data.length === 0) {
			console.warn("No commands initialized - bot will not respond to any command queries");
		}
		if (!Command.prefix) {
			console.warn("No command prefix configured - bot will not respond to any command queries");
		}

		const names = Command.data.flatMap(i => [i.Name, ...(i.Aliases ?? [])]);
		const duplicates = names.filter((i, ind, arr) => arr.indexOf(i) !== ind);
		for (const dupe of duplicates) {
			const affected = Command.data.filter(i => i.Aliases.includes(dupe));
			for (const command of affected) {
				const index = command.Aliases.indexOf(dupe);
				command.Aliases.splice(index, 1);
				console.warn(`Removed duplicate command name "${dupe}" from command ${command.Name}'s aliases`);
			}
		}
	}

	static get (identifier) {
		if (identifier instanceof Command) {
			return identifier;
		}
		else if (typeof identifier === "string") {
			return Command.data.find(command => command.Name === identifier || command.Aliases.includes(identifier));
		}
		else {
			throw new sb.Error({
				message: "Invalid command identifier type",
				args: {
					id: String(identifier),
					type: typeof identifier
				}
			});
		}
	}

	static async checkAndExecute (identifier, argumentArray, channelData, userData, options = {}) {
		if (!identifier) {
			return { success: false, reason: "no-identifier" };
		}

		if (!Array.isArray(argumentArray)) {
			throw new sb.Error({
				message: "Command arguments must be provided as an array"
			});
		}

		if (channelData?.Mode === "Inactive" || channelData?.Mode === "Read") {
			return {
				success: false,
				reason: `channel-${channelData.Mode.toLowerCase()}`
			};
		}

		// Special parsing of privileged characters - they can be joined with other characters, and still be usable
		// as a separate command.
		if (typeof identifier === "string" && Command.privilegedCommandCharacters.length > 0) {
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
		const channelID = (channelData?.ID ?? Command.#privateMessageChannelID);
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
		const isAdmin = await userData.getDataProperty("administrator");

		if (!options.skipPending && isAdmin !== true) {
			const sourceName = channelData?.Name ?? `${options.platform.Name} PMs`;
			Command.#cooldownManager.setPending(
				userData.ID,
				`You have a pending command: "${identifier}" used in "${sourceName}" at ${new sb.Date().sqlDateTime()}`
			);
		}

		const appendOptions = { ...options };
		const isPrivateMessage = (!channelData);

		const contextOptions = {
			platform: options.platform,
			invocation: identifier,
			user: userData,
			channel: channelData,
			command,
			transaction: null,
			privateMessage: isPrivateMessage,
			append: appendOptions,
			params: {}
		};

		/** @type {RegExp} */
		const whitespaceRegex = sb.Config.get("WHITESPACE_REGEX");
		let args = argumentArray
			.map(i => i.replace(whitespaceRegex, ""))
			.filter(Boolean);

		// If the command is rollback-able, set up a transaction.
		// The command must use the connection in transaction - that's why it is passed to context
		if (command.Flags.rollback) {
			contextOptions.transaction = await sb.Query.getTransaction();
		}

		let failedParamsParseResult;
		if (command.Params.length > 0) {
			const result = Command.parseParametersFromArguments(command.Params, args);

			// Don't exit immediately, save the result and check filters first
			if (result.success === false) {
				failedParamsParseResult = result;
			}
			else {
				args = result.args;
				contextOptions.params = result.parameters;
			}
		}

		/** @type {ExecuteResult} */
		const filterData = await Filter.execute({
			user: userData,
			command,
			invocation: identifier,
			channel: channelData ?? null,
			platform: channelData?.Platform ?? null,
			targetUser: args[0] ?? null,
			args: args ?? []
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

			Command.#cooldownManager.set(channelID, userData.ID, command.Name, length);

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

		let execution;
		const context = options.context ?? new Context(command, contextOptions);

		try {
			const start = process.hrtime.bigint();
			execution = await command.execute(context, ...args);
			const end = process.hrtime.bigint();

			let result = null;
			if (execution?.reply) {
				result = execution.reply.trim().slice(0, 300);
			}
			else if (execution?.partialReplies) {
				result = execution.partialReplies
					.map(i => i.message)
					.join(" ")
					.trim()
					.slice(0, 300);
			}

			metric.inc({
				name: command.Name,
				result: (execution?.success === false) ? "fail" : "success"
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
				Execution_Time: sb.Utils.round(Number(end - start) / 1.0e6, 3)
			});
		}
		catch (e) {
			metric.inc({
				name: command.Name,
				result: "error"
			});

			let origin = "Internal";
			let errorContext;
			const loggingContext = {
				user: userData.ID,
				command: command.Name,
				invocation: identifier,
				channel: channelData?.ID ?? null,
				platform: options.platform.ID,
				params: context.params ?? {},
				isPrivateMessage
			};

			if (e instanceof sb.Error.GenericRequest) {
				origin = "External";
				const { hostname, statusCode, statusMessage } = e.args;
				errorContext = {
					type: "Command request error",
					hostname,
					message: e.simpleMessage,
					statusCode,
					statusMessage
				};
			}
			else if (e instanceof sb.Got.RequestError) {
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

			if (e instanceof sb.Error.GenericRequest) {
				const { hostname } = errorContext;
				execution = {
					success: false,
					reason: "generic-request-error",
					reply: `Third party service ${hostname} failed! 🚨 (ID ${errorID})`
				};
			}
			else if (e instanceof sb.Got.RequestError) {
				execution = {
					success: false,
					reason: "got-error",
					reply: `Third party service failed! 🚨 (ID ${errorID})`
				};
			}
			else {
				const prettify = (await channelData?.getDataProperty("showFullCommandErrorMessage"))
					? sb.Config.get("COMMAND_ERROR_DEVELOPER")
					: sb.Config.get("COMMAND_ERROR_GENERIC");

				execution = {
					success: false,
					reason: "error",
					reply: prettify(errorID, e)
				};
			}
		}

		// unset pending cooldown, before anything else - even read-only commands should unset it (despite not
		// having any cooldown themselves)
		Command.#cooldownManager.unsetPending(userData.ID);

		// Read-only commands never reply with anything - banphrases, mentions and cooldowns are not checked
		if (command.Flags.readOnly) {
			return {
				success: execution?.success ?? true
			};
		}

		Command.handleCooldown(channelData, userData, command, execution?.cooldown, identifier);

		if (!execution) {
			return execution;
		}
		else if (typeof execution.reply !== "string" && !execution.partialReplies) {
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
				if (bancheck === true) {
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
		if (!command.Flags.skipBanphrase && !metaSkip) {
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

			if (command.Flags.rollback) {
				if (passed) {
					await context.transaction.commit();
				}
				else {
					await context.transaction.rollback();
				}

				await context.transaction.end();
			}
		}
		else if (command.Flags.rollback) {
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
			&& command.Flags.mention
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

	static handleCooldown (channelData, userData, commandData, cooldownData, identifier) {
		// Take care of private messages, where channel === null
		const channelID = channelData?.ID ?? Command.#privateMessageChannelID;

		if (typeof cooldownData !== "undefined") {
			if (cooldownData !== null) {
				if (!Array.isArray(cooldownData)) {
					cooldownData = [cooldownData];
				}

				for (let cooldown of cooldownData) {
					if (typeof cooldown === "number") {
						cooldown = { length: cooldown };
					}

					let { length = 0 } = cooldown;
					const {
						channel = channelID,
						user = userData.ID,
						command = commandData.Name,
						ignoreCooldownFilters = false,
						options = {}
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

					Command.#cooldownManager.set(channel, user, command, length, options);
				}
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

	static extractMetaResultProperties (execution) {
		const result = {};
		for (const [key, value] of Object.entries(execution)) {
			if (typeof value === "boolean") {
				result[key] = value;
			}
		}

		return result;
	}

	static parseParameter (value, type, explicit) {
		// Empty implicit string value is always invalid, since that is written as `$command param:` which is a typo/mistake
		if (type === "string" && explicit === false && value === "") {
			return null;
		}
		// Non-string parameters are also always invalid with empty string value, regardless of implicitness
		else if (type !== "string" && value === "") {
			return null;
		}

		if (type === "string") {
			return String(value);
		}
		else if (type === "number") {
			const output = Number(value);
			if (!Number.isFinite(output)) {
				return null;
			}

			return output;
		}
		else if (type === "boolean") {
			if (value === "true") {
				return true;
			}
			else if (value === "false") {
				return false;
			}
		}
		else if (type === "date") {
			const date = new sb.Date(value);
			if (Number.isNaN(date.valueOf())) {
				return null;
			}

			return date;
		}
		else if (type === "object") {
			const [key, outputValue] = value.split("=");
			return { key, value: outputValue };
		}
		else if (type === "regex") {
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
						source = source.replaceAll(/(?<!\\)([a-z])/ig, (total, match) => `[${match.toLowerCase()}${match.toUpperCase()}]`);
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
		else if (type === "language") {
			return LanguageCodes.getLanguage(value);
		}

		return null;
	}

	static createFakeContext (commandData, contextData = {}, extraData = {}) {
		if (!(commandData instanceof Command)) {
			throw new sb.Error({
				message: "First provided argument must be an instance of Command",
				args: {
					type: typeof commandData,
					name: commandData?.constructor?.name ?? "(none)"
				}
			});
		}

		const data = {
			invocation: contextData.invocation ?? commandData.Name,
			user: contextData.user ?? null,
			channel: contextData.channel ?? null,
			platform: contextData.platform ?? null,
			transaction: contextData.transaction ?? null,
			privateMessage: contextData.isPrivateMessage ?? false,
			append: contextData.append ?? {},
			params: contextData.params ?? {},
			...extraData
		};

		return new Context(commandData, data);
	}

	static #parseAndAppendParameter (value, parameterDefinition, explicit, existingParameters) {
		const parameters = { ...existingParameters };
		const parsedValue = Command.parseParameter(value, parameterDefinition.type, explicit);
		if (parsedValue === null) {
			return {
				success: false,
				reply: `Could not parse parameter "${parameterDefinition.name}"!`
			};
		}
		else if (parameterDefinition.type === "object") {
			if (typeof parameters[parameterDefinition.name] === "undefined") {
				parameters[parameterDefinition.name] = {};
			}

			if (typeof parameters[parameterDefinition.name][parsedValue.key] !== "undefined") {
				return {
					success: false,
					reply: `Cannot use multiple values for parameter "${parameterDefinition.name}", key ${parsedValue.key}!`
				};
			}

			parameters[parameterDefinition.name][parsedValue.key] = parsedValue.value;
		}
		else {
			parameters[parameterDefinition.name] = parsedValue;
		}

		return { success: true, newParameters: parameters };
	}

	static parseParametersFromArguments (paramsDefinition, argsArray) {
		const argsStr = argsArray.join(" ");
		const outputArguments = [];
		let parameters = {};

		// Buffer used to store read characters before we know what to do with them
		let buffer = "";
		/** Parameter definition of the current parameter @type {typeof paramsDefinition[0] | null} */
		let currentParam = null;
		// is true if currently reading inside of a parameter
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
				if (!quotedParam && char === " ") {
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
					else {
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
					reply: `Unclosed quoted parameter "${currentParam.name}"!`
				};
			}
			else {
				const value = Command.#parseAndAppendParameter(buffer, currentParam, quotedParam, parameters);
				if (!value.success) {
					return value;
				}
				parameters = value.newParameters;
			}
		}
		else if (buffer !== "" && buffer !== Command.ignoreParametersDelimiter) {
			// Ignore the last parameter if its the delimiter
			outputArguments.push(buffer);
		}

		return {
			success: true,
			parameters,
			args: outputArguments
		};
	}

	static is (string) {
		const prefix = Command.prefix;
		if (prefix === null) {
			return false;
		}

		return (string.startsWith(prefix) && string.trim().length > prefix.length);
	}

	static destroy () {
		for (const command of Command.data) {
			command.destroy();
		}

		super.destroy();
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

module.exports = Command;
