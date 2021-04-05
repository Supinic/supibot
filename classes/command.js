class Context {
	#invocation;
	#user;
	#channel;
	#platform;
	#transaction = null;
	#privateMessage = false;
	#append = {};
	#params = {};

	constructor (data = {}) {
		this.#invocation = data.invocation ?? null;
		this.#user = data.user ?? null;
		this.#channel = data.channel ?? null;
		this.#platform = data.platform ?? null;
		this.#transaction = data.transaction ?? null;
		this.#privateMessage = data.privateMessage ?? false;
		this.#append = data.append ?? {};
		this.#params = data.params ?? {};
	}

	/**
	 * Fetches the proper permissions for a provided user/channel/platform combo, substituting those that are not
	 * provided with the context's own options.
	 * @param {"any"|"all"|"array"} type Determines the result "shape" - `any` returns true if at least one flag is set,
	 * `all` returns true if all are set, and `array` returns the boolean array as is
	 * @param {UserPermissionLevel[]} levels The permission levels to check
	 * @param {Object} options
	 * @param {User} [options.user]
	 * @param {Channel} [options.channel]
	 * @param {Platform} [options.platform]
	 * @returns {Promise<boolean[]|boolean>}
	 */
	async getUserPermissions (type, levels, options = {}) {
		const userData = options.user ?? this.#user;
		const channelData = options.channel ?? this.#channel;
		const platformData = options.platform ?? this.#platform;

		const promises = levels.map(async (level) => {
			if (level === "admin") {
				return Boolean(userData?.Data.administrator);
			}
			else if (level === "owner") {
				return Boolean(await platformData?.isUserChannelOwner(channelData, userData));
			}
			else if (level === "ambassador") {
				return Boolean(channelData?.isUserAmbassador(userData));
			}
		});

		const result = await Promise.all(promises);
		if (type === "any") {
			return result.some(Boolean);
		}
		else if (type === "all") {
			return result.every(Boolean);
		}
		else if (type === "array") {
			return result;
		}
	}

	/**
	 * Fetches the best available emote for given context - based on platform/channel availability
	 * @param {string[]} emotes
	 * @param {string} fallback
	 * @param {Object} options
	 * @param {Channel} [options.channel]
	 * @param {Platform} [options.platform]
	 * @param {boolean} [options.returnEmoteObject]
	 * @param {Function} [options.filter]
	 * @returns {Promise<string>}
	 */
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

	get invocation () { return this.#invocation; }
	get user () { return this.#user; }
	get channel () { return this.#channel; }
	get platform () { return this.#platform; }
	get transaction () { return this.#transaction; }
	get privateMessage () { return this.#privateMessage; }
	get append () { return this.#append; }
	get params () { return this.#params; }
}

class Command extends require("./template.js") {
	//<editor-fold defaultstate="collapsed" desc="=== INSTANCE PROPERTIES ===">

	/**
	 * Unique numeric ID.
	 * If the command is anonymous, a Symbol() takes its place.
	 * @type {number|symbol}
	 */
	ID;

	/**
	 * Unique command name.
	 * @type {string}
	 */
	Name;

	/**
	 * Array of string aliases. Can be empty if none are provided.
	 * @type {string[]}
	 */
	Aliases = [];

	/**
	 * Command description. Also used for the help meta command.
	 * @type {string|null}
	 */
	Description = null;

	/**
	 * Command cooldown, in milliseconds.
	 * @type {number}
	 */
	Cooldown;

	/**
	 * Holds all flags of a command, all of which are booleans.
	 * This object is frozen after initialization, so that the flags can only be modified outside of runtime.
	 * @type {CommandFlagsObject}
	 */
	Flags = {};

	/**
	 * Contains info about the command's parameters - these are formatted as (name):(value)
	 * @type {CommandParameterDefinition[]|null}
	 */
	Params = [];

	/**
	 * If not null, specified the response for a whitelisted command when invoked outside of the whitelist.
	 * @type {string|null}
	 */
	Whitelist_Response = null;

	/**
	 * Determines the author of the command. Used for updates and further command downloads.
	 * If null, the command is considered created anonymously.
	 * @type {string}
	 */
	#Author = null;

	/**
	 * Session-specific data for the command that can be modified at runtime.
	 * @type {Object}
	 */
	data = {};

	/**
	 * Data specific for the command. Usually hosts utils methods, or constants.
	 * The object is deeply frozen, preventing any changes.
	 * @type {Object}
	 */
	staticData = {};

	// </editor-fold>

	static #privateMessageChannelID = Symbol("private-message-channel");
	static #serializableProperties = {
		Name: { type: "string" },
		Aliases: { type: "descriptor" },
		Author: { type: "string" },
		Cooldown: { type: "descriptor" },
		Description: { type: "string" },
		Flags: { type: "json" },
		Params: { type: "json" },
		Whitelist_Response: { type: "string" },
		Static_Data: { type: "descriptor" },
		Code: { type: "descriptor" },
		Dynamic_Description: { type: "descriptor" }
	};

	constructor (data) {
		super();

		this.ID = data.ID ?? Symbol();

		this.Name = data.Name;
		if (typeof this.Name !== "string" || this.Name.length === 0) {
			console.error(`Command ID ${this.ID} has an unusuable name`, data.Name);
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

		if (this.Flags.linkOnly) {
			if (!this.Params) {
				console.warn("Command has linkOnly flag, but no params are defined.", { commandName: this.Name });
				this.Params.push({
					name: "linkOnly",
					type: "boolean"
				});
			}
			else {
				const param = this.Params.find(i => i.name === "linkOnly");
				if (!param) {
					console.warn("Command has linkOnly flag, but no linkOnly param.", { commandName: this.Name });
					this.Params.push({
						name: "linkOnly",
						type: "boolean"
					});
				}
				else if (param.type !== "boolean") {
					console.warn("Command has linkOnly flag, but the linkOnly param is not boolean.", { data, command: this });
					param.type = "boolean";
				}
			}
		}

		Object.freeze(this.Flags);

		this.Whitelist_Response = data.Whitelist_Response;

		this.#Author = data.Author ?? null;

		try {
			this.Code = eval(data.Code);
		}
		catch (e) {
			console.error(`Command ${this.ID} has invalid code definition!`, e);
			this.Code = async () => ({
				success: false,
				reply: "Command has invalid code definition! Please make sure to let @supinic know about this!"
			});
		}

		if (data.Static_Data) {
			let tempData = null;
			try {
				tempData = eval(data.Static_Data);
			}
			catch (e) {
				console.warn(`Command has invalid static data definition!`, { commandName: this.Name, error: e });
				this.Code = () => ({
					success: false,
					reply: "Command has invalid code definition! Please make sure to let @supinic know about this!"
				});
			}

			if (typeof tempData === "function") {
				tempData = tempData(this);
			}

			if (tempData && typeof tempData === "object") {
				this.staticData = tempData;
			}
			else {
				console.warn(`Command ${this.ID} has invalid static data type!`, e);
				this.Code = async () => ({
					success: false,
					reply: "Command has invalid code definition! Please make sure to let @supinic know about this!"
				});
			}
		}

		sb.Utils.deepFreeze(this.staticData);
	}

	/**
	 * Destroys the command instance.
	 */
	destroy () {
		if (typeof this.staticData.destroy === "function") {
			try {
				this.staticData.destroy(this);
			}
			catch (e) {
				console.warn("command destroy failed", { command: this.Name, error: e });
			}
		}

		this.Code = null;
		this.Flags = null;
		this.Aliases = null;
		this.data = null;
		this.staticData = null;
	}

	/**
	 * Executes the command.
	 * @param {*[]} args
	 * @returns CommandResult
	 */
	execute (...args) {
		return this.Code(...args);
	}

	async serialize (options = {}) {
		if (typeof this.ID !== "number") {
			throw new sb.Error({
				message: "Cannot serialize an anonymous Command",
				args: {
					ID: this.ID,
					Name: this.Name
				}
			});
		}

		const row = await sb.Query.getRow("chat_data", "Command");
		await row.load(this.ID);

		return await super.serialize(row, Command.#serializableProperties, options);
	}

	getCacheKey () {
		return `sb-command-${this.ID}`;
	}

	get Author () { return this.#Author; }

	static async loadData () {
		const data = await sb.Query.getRecordset(rs => rs
			.select("*")
			.from("chat_data", "Command")
			.where("Flags NOT %*like* OR Flags IS NULL", "archived")
		);

		Command.data = data.map(record => new Command(record));

		if (Command.data.length === 0) {
			console.warn("No commands initialized - bot will not respond to any command queries");
		}

		if (!sb.Config) {
			console.warn("sb.Config module missing - cannot fetch command prefix");
		}
		else if (Command.prefix === null) {
			console.warn("Command prefix is configured as `null` - bot will not respond to any command queries");
		}

		const names = Command.data.map(i => [i.Name, ...i.Aliases]).flat();
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

	/**
	 * Reloads a specific list of commands.
	 * @param {string[]} list
	 * @returns {Promise<void>} True if passed, false if
	 * @throws {sb.Error} If the list contains 0 valid commands
	 */
	static async reloadSpecific (...list) {
		if (list.length === 0) {
			return false;
		}

		const existingCommands = list.map(i => Command.get(i)).filter(Boolean);
		for (const command of existingCommands) {
			const index = Command.data.findIndex(i => i.ID === command.ID);

			command.destroy();

			if (index !== -1) {
				Command.data.splice(index, 1);
			}
		}

		const data = await sb.Query.getRecordset(rs => {
			rs.select("*")
				.from("chat_data", "Command")
				.where("Flags NOT %*like* OR Flags IS NULL", "archived");

			const nameConditions = list.map(i => {
				const name = sb.Query.escapeString(i);
				return `(Name = '${name}' OR JSON_CONTAINS(Aliases, JSON_QUOTE('${name}')))`;
			});

			rs.where(nameConditions.join(" OR "));

			return rs;
		});

		for (const record of data) {
			const command = new Command(record);
			Command.data.push(command);
		}

		return true;
	}

	/**
	 * Searches for a command, based on its ID, Name or Alias.
	 * Returns immediately if identifier is already a Command.
	 * @param {Command|number|string|symbol} identifier
	 * @returns {Command|null}
	 * @throws {sb.Error} If identifier is unrecognized
	 */
	static get (identifier) {
		if (identifier instanceof Command) {
			return identifier;
		}
		else if (typeof identifier === "number" || typeof identifier === "symbol") {
			return Command.data.find(command => command.ID === identifier);
		}
		else if (typeof identifier === "string") {
			return Command.data.find(command =>
				command.Name === identifier ||
				command.Aliases.includes(identifier)
			);
		}
		else {
			throw new sb.Error({
				message: "Invalid command identifier type",
				args: { id: identifier, type: typeof identifier }
			});
		}
	}

	/**
	 * Checks if a command exists, and executes it if needed.
	 * @param {Command|number|string} identifier
	 * @param {string[]} argumentArray
	 * @param {Channel|null} channelData
	 * @param {User} userData
	 * @param {Object} options = {} any extra options that will be passed to the command as extra.append
	 * @param {boolean} [options.skipMention] If true, no mention will be added to the command string, regardless of other options.
	 * @returns {CommandResult}
	 */
	static async checkAndExecute (identifier, argumentArray, channelData, userData, options = {}) {
		if (!identifier) {
			return {success: false, reason: "no-identifier"};
		}

		if (!Array.isArray(argumentArray)) {
			throw new sb.Error({
				message: "Command arguments must be provided as an array"
			});
		}

		if (channelData?.Mode === "Inactive" || channelData?.Mode === "Read") {
			return {success: false, reason: "channel-" + channelData.Mode.toLowerCase()};
		}

		const command = Command.get(identifier);
		if (!command) {
			return {success: false, reason: "no-command"};
		}

		// Check for cooldowns, return if it did not pass yet.
		// If skipPending flag is set, do not check for pending status.
		const channelID = (channelData?.ID ?? Command.#privateMessageChannelID);
		if (
			!userData.Data.cooldownImmunity
			&& !sb.CooldownManager.check(
				channelID,
				userData.ID,
				command.ID,
				Boolean(options.skipPending)
			)
		) {
			if (!options.skipPending) {
				const pending = sb.CooldownManager.fetchPending(userData.ID);
				if (pending) {
					return {
						reply: (options.privateMessage) ? pending.description : null,
						reason: "pending"
					}
				}
			}

			return { success: false, reason: "cooldown" };
		}

		// If skipPending flag is set, do not set the pending status at all.
		// Used in pipe command, for instance.
		if (!options.skipPending) {
			const sourceName = channelData?.Name ?? "private messages";
			sb.CooldownManager.setPending(
				userData.ID,
				`You have a pending command: "${identifier}" used in "${sourceName}" at ${new sb.Date().sqlDateTime()}`
			);
		}

		const filterData = await sb.Filter.execute({
			user: userData,
			command: command,
			invocation: identifier,
			channel: channelData ?? null,
			platform: channelData?.Platform ?? null,
			targetUser: argumentArray[0] ?? null,
			args: argumentArray ?? []
		});

		if (!filterData.success) {
			sb.CooldownManager.unsetPending(userData.ID);
			sb.CooldownManager.set(channelID, userData.ID, command.ID, command.Cooldown);
			await sb.Runtime.incrementRejectedCommands();

			if (filterData.filter.Response === "Reason" && typeof filterData.reply === "string") {
				const { string } = await sb.Banphrase.execute(filterData.reply, channelData);
				filterData.reply = string;
			}

			return filterData;
		}

		const appendOptions = Object.assign({}, options);
		const isPrivateMessage = (!channelData);

		/** @type CommandContext */
		const contextOptions = {
			platform: options.platform,
			invocation: identifier,
			user: userData,
			channel: channelData,
			command: command,
			transaction: null,
			privateMessage: isPrivateMessage,
			append: appendOptions,
			params: {}
		};

		let args = argumentArray
			.map(i => i.replace(sb.Config.get("WHITESPACE_REGEX"), ""))
			.filter(Boolean);

		// If the command is rollbackable, set up a transaction.
		// The command must use the connection in transaction - that's why it is passed to context
		if (command.Flags.rollback) {
			contextOptions.transaction = await sb.Query.getTransaction();
		}

		if (command.Params.length > 0) {
			const paramNames = command.Params.map(i => i.name);

			let argsString = args.join(" ");
			const quotesRegex = new RegExp(`(?<name>${paramNames.join("|")}):(?<!\\\\)"(?<value>.+?)(?<!\\\\)"`, "g");
			const quoteMatches = [...argsString.matchAll(quotesRegex)];

			for (const match of quoteMatches.reverse()) {
				argsString = argsString.slice(0, match.index) + argsString.slice(match.index + match[0].length + 1);

				const { name, value } = match.groups;
				const { type } = command.Params.find(i => i.name === name);

				if (name && value) {
					const cleanValue = value.replace(/^"|"$/g, "").replace(/\\"/g, "\"");
					const parsedValue = Command.parseParameter(cleanValue, type);
					if (parsedValue === null) {
						return {
							success: false,
							reply: `Cannot parse parameter "${name}"!`
						};
					}

					if (type === "object") {
						if (typeof contextOptions.params[name] === "undefined") {
							contextOptions.params[name] = {};
						}
						if (typeof contextOptions.params[name][parsedValue.key] !== "undefined") {
							return {
								success: false,
								reply: `Cannot use multiple values for parameter "${name}", key ${parsedValue.key}!`
							};
						}

						contextOptions.params[name][parsedValue.key] = parsedValue.value;
					}
					else {
						contextOptions.params[name] = parsedValue;
					}
				}
			}

			const remainingArgs = argsString.split(" ");
			const paramRegex = new RegExp(`^(?<name>${paramNames.join("|")}):(?<value>.+)$`);
			for (let i = remainingArgs.length - 1; i >= 0; i--) {
				if (!paramRegex.test(remainingArgs[i])) {
					continue;
				}

				const { name, value } = remainingArgs[i].match(paramRegex).groups;
				const { type } = command.Params.find(i => i.name === name);

				if (name && value) {
					const parsedValue = Command.parseParameter(value, type);
					if (parsedValue === null) {
						return {
							success: false,
							reply: `Cannot parse parameter "${name}"!`
						};
					}

					if (type === "object") {
						if (typeof contextOptions.params[name] === "undefined") {
							contextOptions.params[name] = {};
						}
						if (typeof contextOptions.params[name][parsedValue.key] !== "undefined") {
							return {
								success: false,
								reply: `Cannot use multiple values for parameter "${name}", key ${parsedValue.key}!`
							};
						}

						contextOptions.params[name][parsedValue.key] = parsedValue.value;
					}
					else {
						contextOptions.params[name] = parsedValue;
					}

					remainingArgs.splice(i, 1);
				}
			}

			args = remainingArgs.filter(Boolean)
		}

		/** @type CommandResult */
		let execution;
		const context = new Context(contextOptions);

		try {
			const start = process.hrtime.bigint();
			execution = await command.Code(context, ...args);
			const end = process.hrtime.bigint();

			let result = null;
			if (execution?.reply) {
				result = execution.reply.trim().slice(0, 300);
			}
			else if (execution?.partialReplies) {
				result = execution.partialReplies.map(i => i.message).join(" ").trim().slice(0, 300);
			}

			await sb.Runtime.incrementCommandsCounter();

			if (typeof command.ID === "number") {
				sb.Logger.logCommandExecution({
					User_Alias: userData.ID,
					Command: command.ID,
					Platform: options.platform.ID,
					Executed: new sb.Date(),
					Channel: channelData?.ID ?? null,
					Success: true,
					Invocation: identifier,
					Arguments: JSON.stringify(args),
					Result: result,
					Execution_Time: sb.Utils.round(Number(end - start) / 1.0e6, 3),
					Command_Name: command.Name
				});
			}
		}
		catch (e) {
			if (e instanceof sb.errors.APIError) {
				const { apiName, reason, statusCode } = e;
				console.warn("Command API Error", { apiName, statusCode, reason });

				execution = {
					success: false,
					reason: "api-error",
					reply: `${statusCode}: Couldn't execute command because ${apiName} failed! This is not my fault :)`
				};
			}
			else if (e instanceof sb.errors.GenericRequestError) {
				const { hostname, message, statusCode, statusMessage } = e;
				console.warn("Command request error", { hostname, message, statusCode, statusMessage });

				execution = {
					success: false,
					reason: "generic-request-error",
					reply: `Third party ${hostname} failed: ${message ?? "(no message)"}`
				};
			}
			else {
				console.error(e);
				if (typeof command.ID === "number") {
					const loggingContext = {
						user: userData.ID,
						command: command.ID,
						invocation: identifier,
						channel: channelData?.ID ?? null,
						platform: options.platform.ID,
						params: context.params ?? {},
						isPrivateMessage
					};
					const errorID = await sb.SystemLogger.sendError("Command", e, [loggingContext, identifier, ...args]);
					const prettify = (channelData?.Data.developer)
						? sb.Config.get("COMMAND_ERROR_DEVELOPER")
						: sb.Config.get("COMMAND_ERROR_GENERIC");

					execution = {
						success: false,
						reason: "error",
						reply: prettify(errorID, e)
					};
				}
				else {
					execution = {
						success: false,
						reason: "error",
						reply: "Anonymous command failed!"
					};
				}
			}
		}

		// Read-only commands never reply with anything - banphrases, mentions and cooldowns are not checked
		if (command.Flags.readOnly) {
			return {
				success: execution?.success ?? true
			};
		}

		// Check if a link-only flagged command returns a proper link to be used, if the command didn't fail
		if (execution && execution.success !== false && command.Flags.linkOnly) {
			if (typeof execution.link !== "string" && execution.link !== null) {
				throw new sb.Error({
					message: "Commands supporting link-only mode must always return a possible link as string or null",
					args: {
						command: command.ID
					}
				});
			}

			if (context.params.linkOnly === true) {
				if (execution.link === null) {
					execution.success = false;
					execution.reply = "No link is present in command result!";
				}
				else {
					execution.reply = execution.link;
				}

				delete execution.link;

			}
		}

		Command.handleCooldown(channelData, userData, command, execution?.cooldown);

		if (!execution?.reply && !execution?.partialReplies) {
			return execution;
		}

		if (Array.isArray(execution.partialReplies)){
			if (execution.partialReplies.some(i => i && i.constructor !== Object)) {
				throw new sb.Error({
					message: "If set, partialReplies must be an Array of Objects"
				});
			}

			const partResult = [];
			for (const {message, bancheck} of execution.partialReplies) {
				if (bancheck === true) {
					const {string} = await sb.Banphrase.execute(
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

		if (typeof execution.reply !== "string") {
			console.warn(`Execution of command "${command.Name}" did not result with execution.reply of type string`);
		}

		execution.reply = String(execution.reply).trim();

		const metaSkip = Boolean(!execution.partialReplies && (options.skipBanphrases || execution?.meta?.skipBanphrases));
		if (!command.Flags.skipBanphrase && !metaSkip) {
			const { passed, privateMessage, string } = await sb.Banphrase.execute(execution.reply.slice(0, 2000), channelData);
			execution.reply = string;

			if (
				(typeof execution.replyWithPrivateMessage !== "boolean" )
				&& (typeof privateMessage === "boolean")
			) {
				execution.replyWithPrivateMessage = privateMessage;
			}

			if (command.Flags.rollback) {
				if (passed) {
					context.transaction.commit();
				}
				else {
					context.transaction.rollback();
				}

				context.transaction.end();
			}
		}
		else if (command.Flags.rollback) {
			context.transaction.commit();
			context.transaction.end();
		}

		// Apply all unpings to the result, if it is still a string (aka the response should be sent)
		if (typeof execution.reply === "string") {
			execution.reply = await sb.Filter.applyUnping({
				command: command,
				channel: channelData ?? null,
				platform: channelData?.Platform ?? null,
				string: execution.reply
			});
		}

		const mentionUser = Boolean(
			!options.skipMention
			&& command.Flags.mention
			&& channelData?.Mention
			&& await sb.Filter.getMentionStatus({
				user: userData,
				command: command,
				channel: channelData ?? null,
				platform: channelData?.Platform ?? null
			})
		);

		if (mentionUser) {
			const { string } = await sb.Banphrase.execute(
				userData.Name,
				channelData
			);

			execution.reply = string + ", " + execution.reply;
		}

		if (!options.partialExecute && execution.success !== false && execution.aliased && !execution.skipAliasPrefix) {
			execution.reply = "👥 " + execution.reply;
		}

		return execution;
	}

	/**
	 * Handles the setting (or skipping) cooldowns for given combination of data.
	 * @param {Channel} channelData
	 * @param {User} userData
	 * @param {Command} commandData
	 * @param {Object} cooldownData
	 */
	static handleCooldown (channelData, userData, commandData, cooldownData) {
		// Take care of private messages, where channel === null
		const channelID = channelData?.ID ?? Command.#privateMessageChannelID;

		if (commandData.Flags.ownerOverride && channelData?.isUserChannelOwner(userData)) {
			// Set a very small, only technical cooldown
			sb.CooldownManager.set(channelID, userData.ID, commandData.ID, 500);
		}
		else if (typeof cooldownData !== "undefined") {
			if (cooldownData !== null) {
				if (!Array.isArray(cooldownData)) {
					cooldownData = [cooldownData];
				}

				for (let cooldown of cooldownData) {
					if (typeof cooldown === "number") {
						cooldown = { length: cooldown };
					}

					const {
						channel = channelID,
						user = userData.ID,
						command = commandData.ID,
						length,
						options = {}
					} = cooldown;

					sb.CooldownManager.set(channel, user, command, length, options);
				}
			}
			else {
				// If cooldownData === null, no cooldown is set at all.
			}
		}
		else {
			sb.CooldownManager.set(channelID, userData.ID, commandData.ID, commandData.Cooldown);
		}

		sb.CooldownManager.unsetPending(userData.ID);
	}

	static async install (options = {}) {
		let data = null;
		if (options.filePath) {
			data = require(options.filePath);
		}
		else {
			const Module = require("module");
			const mod = new Module();
			mod._compile(options.data, "");
			data = mod.exports;
		}

		const conflictingAliases = Command.data.filter(i => i.Aliases.includes(data.Name));
		if (conflictingAliases.length > 0) {
			return {
				success: false,
				result: "conflicting-alias"
			};
		}

		let result = "";
		const conflictIndex = Command.data.findIndex(i => i.Name === data.Name);
		if (conflictIndex !== -1) {
			if (options.override) {
				const previous = Command.data[conflictIndex];
				Command.data[conflictIndex] = new Command({
					ID: previous.ID,
					...data
				});

				const row = await sb.Query.getRow("chat_data", "Command");
				await row.load(previous.ID);
				row.setValues(data);
				await row.save();

				previous.destroy();
				result = "updated";
			}
			else {
				return {
					success: false,
					reason: "conflicting-name"
				};
			}
		}
		else {
			const row = await sb.Query.getRow("chat_data", "Command");
			row.setValues(data);
			await row.save();

			Command.data.push(new Command({
				ID: row.values.ID,
				...data
			}));

			result = "added";
		}

		return {
			success: true,
			result
		};
	}

	static parseParameter (value, type) {
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
			return new sb.Date(value);
		}
		else if (type === "object") {
			const [key, outputValue] = value.split("=");
			return { key, value: outputValue };
		}
		else {
			return null;
		}
	}

	/**
	 * Creates a functioning command context, with data filled in based on what data is passed
	 * @param {Command} commandData
	 * @param {Object|CommandContext} [contextData]
	 * @returns {CommandContext}
	 */
	static createFakeContext (commandData, contextData = {}) {
		return new Context({
			invocation: commandData.Name,
			user: contextData.user ?? null,
			channel: contextData.channel ?? null,
			platform: contextData.platform ?? null,
			transaction: contextData.transaction ?? null,
			privateMessage: contextData.isPrivateMessage ?? false,
			append: contextData.append ?? {},
			params: contextData.params ?? {}
		});
	}

	/**
	 * Checks if the given string counts as a proper command execution.
	 * @param {string} string
	 * @returns {boolean}
	 */
	static is (string) {
		const prefix = Command.getPrefix();
		if (prefix === null) {
			return false;
		}

		return (string.startsWith(prefix) && string.trim().length > prefix.length)
	}

	static destroy () {
		for (const command of Command.data) {
			command.destroy();
		}

		super.destroy();
	}

	static get prefixRegex () {
		const prefix = Command.prefix;
		if (!prefix) {
			return null;
		}

		const body = [...prefix].map(char => (/\w/.test(char))
			? char
			: `\\${char}`
		).join("");

		return new RegExp("^" + body);
	}

	static get prefix () {
		return Command.getPrefix();
	}

	static set prefix (value) {
		return Command.setPrefix(value);
	}

	/**
	 * Fetches the command prefix by fetching the config.
	 * @returns {string|null}
	 */
	static getPrefix () {
		return sb.Config.get("COMMAND_PREFIX", false) ?? null;
	}

	/**
	 * Sets a command prefix by changing the config value.
	 * @param {string} value
	 * @returns {Promise<void>}
	 */
	static setPrefix (value) {
		if (typeof value !== "string") {
			throw new sb.Error({
				message: "Command prefix must be a string!"
			});
		}

		return sb.Config.set("COMMAND_PREFIX", value.trim());
	}
}

module.exports = Command;

/**
 * @typedef {Object} CommandResult
 * @property {boolean} success If true, result contains reply; if false, result contains error
 * @property {string} [reply] Command result as a string to reply. If not provided, no message should be sent
 * @property {Object} [cooldown] Dynamic cooldown settings
 * @property {string} [reason] Symbolic description of why command execution failed - used internally
 * @property {Object} [meta] Any other information passed back from the commend execution
 */

/**
 * @typedef {Object} CommandContext
 * @property {string} invocation Exact command name used for invocation - name or alias
 * @property {User} user Data about the user who invoked the command
 * @property {Channel} channel Data about the channel where the command was invoked
 * @property {Command} command Data about the command being invoked
 * @property {Object} append = {} other platform-specific options
 * @property {?} [transaction] For rollbackable commands, a transaction is set up and later committed/rollbacked.
 * Commands must use this.data.transaction for whatever sbase access should be safeguarded.
 */

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
 * @property {boolean} linkOnly If true, the command will accept "linkOnly:true" as one of its arguments, and if possible, returns just a link, with no text included.
 * @property {boolean} useParams If true, all arguments in form of key:value will be parsed into an object
 * @property {boolean} nonNullable If true, the command cannot be directly piped into the null command
 */

/**
 * @typedef {Object} CommandParameterDefinition
 * @property {string} name Parameter name, as it will be used in execution
 * @property {"string"|"number"|"boolean"|"date"} type Parameter type - string value will be parsed into this type
 */

/**
 * @typedef {"admin"|"owner"|"ambassador"} UserPermissionLevel
 */