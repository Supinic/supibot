/**
 * Represents the context a command is being executed in
 */
class Context {
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
		this.#invocation = data.invocation ?? null;
		this.#user = data.user ?? null;
		this.#channel = data.channel ?? null;
		this.#platform = data.platform ?? null;
		this.#transaction = data.transaction ?? null;
		this.#privateMessage = data.privateMessage ?? false;
		this.#append = data.append ?? this.#append;
		this.#params = data.params ?? this.#params;

		this.#append.tee ??= [];

		this.#userFlags = sb.Filter.getFlags({
			command,
			invocation: this.#invocation,
			platform: this.#platform,
			channel: this.#channel,
			user: this.#user
		});
	}

	getMeta (name) { return this.#meta.get(name); }
	setMeta (name, value) { this.#meta.set(name, value); }

	/**
	 * Fetches an object wrapper describing the user's permissions in given command context.
	 * @param {Object} [options] When provided, allows overriding the command context's locations
	 * @param {sb.User} [options.user]
	 * @param {sb.Channel} [options.channel]
	 * @param {sb.Platform} [options.platform]
	 * @returns {Promise<{
	 *  flag: number,
	 *  is: (function(UserPermissionLevel): boolean)
	 * }>}
	 */
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

		let flag = sb.User.permissions.regular;
		for (const [key, value] of Object.entries(flags)) {
			if (value) {
				flag |= sb.User.permissions[key];
			}
		}

		return {
			flag,
			/**
			 * @param {UserPermissionLevel} type
			 * @returns {boolean}
			 */
			is: (type) => {
				if (!sb.User.permissions[type]) {
					throw new sb.Error({
						message: "Invalid user permission type provided"
					});
				}

				return ((flag & sb.User.permissions[type]) !== 0);
			}
		};
	}

	/**
	 * Fetches the best available emote for given context - based on platform/channel availability
	 * @param {string[]} emotes
	 * @param {string} fallback
	 * @param {Object} options
	 * @param {sb.Channel} [options.channel]
	 * @param {sb.Platform} [options.platform]
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

/**
 * Represents a single bot command.
 * @memberof sb
 */
class Command extends require("./template.js") {
	// <editor-fold defaultstate="collapsed" desc="=== INSTANCE PROPERTIES ===">

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

	/**
	 * Privileged command characters are such characters, that when a command is invoked, there does not have to be any
	 * whitespace separating the character and the first argument.
	 * Consider the bot's prefix to be "!", and the test command string to be `!$foo bar`.
	 * @example If "$" is not privileged:
	 * prefix = "!"; command = "$foo"; arguments = ["bar"];
	 * @example If "$" is privileged:
	 * prefix = "!"; command = "$"; arguments = ["foo", "bar"];
	 * @type {[string]}
	 */
	static privilegedCommandCharacters = ["$"];

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
		else {
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
		}

		if (data.Static_Data) {
			let staticDataFn;

			if (typeof data.Static_Data === "function") {
				staticDataFn = data.Static_Data;
			}
			else {
				try {
					staticDataFn = eval(data.Static_Data);
				}
				catch (e) {
					console.warn(`Command has invalid static data definition!`, { commandName: this.Name, error: e });
					this.Code = () => ({
						success: false,
						reply: "Command has invalid code definition! Please make sure to let @supinic know about this!"
					});
				}
			}

			if (typeof staticDataFn !== "function") {
				console.warn(`Command ${this.ID} static data is not a function!`);
				this.Code = async () => ({
					success: false,
					reply: "Command's static data is not a function!"
				});
			}

			const staticData = staticDataFn(this);

			if (!staticData || staticData?.constructor?.name !== "Object") {
				console.warn(`Command ${this.ID} has invalid static data type!`);
				this.Code = async () => ({
					success: false,
					reply: "Command has invalid static data type!"
				});
			}
			else {
				this.staticData = staticData;
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

	/**
	 * Creates the command's detail URL based on a Configuration variable
	 * @param {Object} [options]
	 * @param {boolean} [options.useCodePath] If true, returns a path for the command's code description
	 * @returns {string}
	 */
	getDetailURL (options = {}) {
		const baseURL = sb.Config.get("COMMAND_DETAIL_URL", false);
		if (!baseURL) {
			return "N/A";
		}

		if (options.useCodePath) {
			return `${baseURL}/${encodeURIComponent(this.Name)}/code`;
		}
		else {
			return `${baseURL}/${encodeURIComponent(this.Name)}`;
		}
	}

	getCacheKey () {
		return `sb-command-${this.Name}`;
	}

	get Author () { return this.#Author; }

	static async loadData () {
		const { definitions } = await require("supibot-package-manager/commands");

		Command.data = definitions.map(record => new Command(record));
		Command.definitions = definitions;

		this.validate();
	}

	static async reloadSpecific (...list) {
		if (list.length === 0) {
			return false;
		}

		const failed = [];
		for (const commandName of list) {
			const originalCommand = Command.get(commandName);
			const identifier = originalCommand?.Name ?? originalCommand?.name ?? commandName;
			if (originalCommand) {
				const commandIndex = Command.data.indexOf(originalCommand);
				if (commandIndex !== -1) {
					Command.data.splice(commandIndex, 1);
				}

				const definitionIndex = Command.definitions.findIndex(i => i.Name === identifier);
				if (commandIndex !== -1) {
					Command.definitions.splice(definitionIndex, 1);
				}

				originalCommand.destroy();
			}

			// Try-catch is mandatory because `require.resolve` throws when the path doesn't exist or is not a module.
			// This might occur when a command name is mistaken. While throwing here is correct, the loading
			// should continue regardless of that.
			let path;
			try {
				path = require.resolve(`supibot-package-manager/commands/${identifier}`);
				delete require.cache[path];
			}
			catch {
				failed.push({
					identifier,
					reason: "no-path"
				});

				continue;
			}

			let definition;
			try {
				definition = require(`supibot-package-manager/commands/${identifier}`);
			}
			catch {
				failed.push({
					identifier,
					reason: "no-definition"
				});

				continue;
			}

			const reloadedCommand = new Command(definition);

			Command.data.push(reloadedCommand);
			Command.definitions.push(definition);
		}

		this.validate();

		return {
			success: true,
			failed
		};
	}

	static validate () {
		if (Command.data.length === 0) {
			console.warn("No commands initialized - bot will not respond to any command queries");
		}

		if (!sb.Config) {
			console.warn("sb.Config module missing - cannot fetch command prefix");
		}
		else if (Command.prefix === null) {
			console.warn("Command prefix is configured as `null` - bot will not respond to any command queries");
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

	/**
	 * Searches for a command, based on its name or alias.
	 * Returns immediately if identifier is already a Command.
	 * @param {sb.Command|string|symbol} identifier
	 * @returns {sb.Command|null}
	 * @throws {sb.Error} If identifier is unrecognized
	 */
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
					id: identifier,
					type: typeof identifier
				}
			});
		}
	}

	/**
	 * Checks if a command exists, and executes it if needed.
	 * @param {sb.Command|string} identifier
	 * @param {string[]} argumentArray
	 * @param {sb.Channel|null} channelData
	 * @param {sb.User} userData
	 * @param {Object} options = {} any extra options that will be passed to the command as extra.append
	 * @param {boolean} [options.internalExecution] currently unused
	 * @param {boolean} [options.skipGlobalBan]
	 * @param {sb.Platform} options.platform
	 * @param {boolean} [options.skipMention] If true, no mention will be added to the command string, regardless of other options.
	 * @returns {CommandResult}
	 */
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
			return { success: false, reason: `channel-${channelData.Mode.toLowerCase()}` };
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

		// Check for cooldowns, return if it did not pass yet.
		// If skipPending flag is set, do not check for pending status.
		const channelID = (channelData?.ID ?? Command.#privateMessageChannelID);
		const cooldownCheck = sb.CooldownManager.check(
			channelID,
			userData.ID,
			command.Name,
			Boolean(options.skipPending)
		);

		if (!cooldownCheck) {
			if (!options.skipPending) {
				const pending = sb.CooldownManager.fetchPending(userData.ID);
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
			sb.CooldownManager.setPending(
				userData.ID,
				`You have a pending command: "${identifier}" used in "${sourceName}" at ${new sb.Date().sqlDateTime()}`
			);
		}

		const appendOptions = { ...options };
		const isPrivateMessage = (!channelData);

		/** @type CommandContext */
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
			const quotesRegex = new RegExp(`(?<name>${paramNames.join("|")}):(?<!\\\\)"(?<value>.*?)(?<!\\\\)"`, "g");
			const quoteMatches = [...argsString.matchAll(quotesRegex)];

			for (const match of quoteMatches.reverse()) {
				argsString = argsString.slice(0, match.index) + argsString.slice(match.index + match[0].length + 1);

				const { name = null, value = null } = match.groups;
				const { type } = command.Params.find(i => i.name === name);

				if (name !== null && value !== null) {
					const cleanValue = value.replace(/^"|"$/g, "").replace(/\\"/g, "\"");
					const parsedValue = Command.parseParameter(cleanValue, type, true);
					if (parsedValue === null) {
						sb.CooldownManager.unsetPending(userData.ID);
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
							sb.CooldownManager.unsetPending(userData.ID);
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
			const paramRegex = new RegExp(`^(?<name>${paramNames.join("|")}):(?<value>.*)$`);
			for (let i = remainingArgs.length - 1; i >= 0; i--) {
				if (!paramRegex.test(remainingArgs[i])) {
					continue;
				}

				const { name = null, value = null } = remainingArgs[i].match(paramRegex).groups;
				const { type } = command.Params.find(i => i.name === name);

				if (name !== null && value !== null) {
					const parsedValue = Command.parseParameter(value, type, false);
					if (parsedValue === null) {
						sb.CooldownManager.unsetPending(userData.ID);
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
							sb.CooldownManager.unsetPending(userData.ID);
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

			args = remainingArgs.filter(Boolean);
		}

		const filterData = await sb.Filter.execute({
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
			sb.CooldownManager.unsetPending(userData.ID);

			let length = command.Cooldown;
			const cooldownFilter = sb.Filter.getCooldownModifiers({
				platform: channelData?.Platform ?? null,
				channel: channelData,
				command,
				invocation: identifier,
				user: userData
			});

			if (cooldownFilter) {
				length = cooldownFilter.applyData(length);
			}

			sb.CooldownManager.set(channelID, userData.ID, command.Name, length);

			await sb.Runtime.incrementRejectedCommands();

			if (filterData.filter.Response === "Reason" && typeof filterData.reply === "string") {
				const { string } = await sb.Banphrase.execute(filterData.reply, channelData);
				filterData.reply = string;
			}

			return filterData;
		}

		/** @type CommandResult */
		let execution;
		const context = options.context ?? new Context(command, contextOptions);

		try {
			const start = process.hrtime.bigint();
			execution = await command.Code(context, ...args);
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

			await sb.Runtime.incrementCommandsCounter();

			sb.Logger.logCommandExecution({
				User_Alias: userData.ID,
				Command: command.Name,
				Platform: options.platform.ID,
				Executed: new sb.Date(),
				Channel: channelData?.ID ?? null,
				Success: true,
				Invocation: identifier,
				Arguments: JSON.stringify(argumentArray.filter(Boolean)),
				Result: result,
				Execution_Time: sb.Utils.round(Number(end - start) / 1.0e6, 3)
			});
		}
		catch (e) {
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

			if (e instanceof sb.errors.GenericRequestError) {
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
			else if (e instanceof sb.Got.GotError) {
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

			if (e instanceof sb.errors.GenericRequestError) {
				const { hostname, message } = errorContext;
				execution = {
					success: false,
					reason: "generic-request-error",
					reply: `🚨 Third party ${hostname} failed! ${message ?? "(no message)"} (error ID ${errorID})`
				};
			}
			else if (e instanceof sb.Got.GotError) {
				execution = {
					success: false,
					reason: "got-error",
					reply: `🚨 Third party network error! ${errorContext.message ?? "(no message)"} (error ID ${errorID})`
				};
			}
			else {
				const prettify = (channelData?.Data.developer)
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
		sb.CooldownManager.unsetPending(userData.ID);

		// Read-only commands never reply with anything - banphrases, mentions and cooldowns are not checked
		if (command.Flags.readOnly) {
			return {
				success: execution?.success ?? true
			};
		}

		Command.handleCooldown(channelData, userData, command, execution?.cooldown);

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
					const { string } = await sb.Banphrase.execute(
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
			const { passed, privateMessage, string } = await sb.Banphrase.execute(execution.reply.slice(0, 2000), channelData);
			execution.reply = string;

			if (
				(typeof execution.replyWithPrivateMessage !== "boolean")
				&& (typeof privateMessage === "boolean")
			) {
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
			execution.reply = await sb.Filter.applyUnping({
				command,
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
				command,
				channel: channelData ?? null,
				platform: channelData?.Platform ?? null
			})
		);

		if (mentionUser) {
			const { string } = await sb.Banphrase.execute(
				userData.Name,
				channelData
			);

			execution.reply = `${string}, ${execution.reply}`;
		}

		if (!options.partialExecute && execution.success !== false && execution.hasExternalInput && !execution.skipExternalPrefix) {
			execution.reply = `👥 ${execution.reply}`;
		}

		return execution;
	}

	/**
	 * Handles the setting (or skipping) cooldowns for given combination of data.
	 * @param {sb.Channel} channelData
	 * @param {sb.User} userData
	 * @param {sb.Command} commandData
	 * @param {Object} cooldownData
	 */
	static handleCooldown (channelData, userData, commandData, cooldownData) {
		// Take care of private messages, where channel === null
		const channelID = channelData?.ID ?? Command.#privateMessageChannelID;

		if (commandData.Flags.ownerOverride && channelData?.isUserChannelOwner(userData)) {
			// Set a very small, only technical cooldown
			sb.CooldownManager.set(channelID, userData.ID, commandData.Name, 500);
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

					let { length } = cooldown;
					const {
						channel = channelID,
						user = userData.ID,
						command = commandData.Name,
						ignoreCooldownFilters = false,
						options = {}
					} = cooldown;

					if (!ignoreCooldownFilters) {
						const cooldownFilter = sb.Filter.getCooldownModifiers({
							platform: channelData?.Platform ?? null,
							channel: channelData,
							command: commandData,
							invocation: null, // @todo
							user: userData
						});

						if (cooldownFilter) {
							length = cooldownFilter.applyData(length);
						}
					}

					sb.CooldownManager.set(channel, user, command, length, options);
				}
			}
			else {
				// If cooldownData === null, no cooldown is set at all.
			}
		}
		else {
			let length = commandData.Cooldown ?? 0;
			const cooldownFilter = sb.Filter.getCooldownModifiers({
				platform: channelData?.Platform ?? null,
				channel: channelData,
				command: commandData,
				invocation: null, // @todo
				user: userData
			});

			if (cooldownFilter) {
				length = cooldownFilter.applyData(length);
			}

			sb.CooldownManager.set(channelID, userData.ID, commandData.Name, length);
		}
	}

	/**
	 * Extracts all boolean values from a command execution result.
	 * @param {CommandResult} execution
	 * @returns {Object}
	 */
	static extractMetaResultProperties (execution) {
		const result = {};
		for (const [key, value] of Object.entries(execution)) {
			if (typeof value === "boolean") {
				result[key] = value;
			}
		}

		return result;
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
			return sb.Utils.parseRegExp(value);
		}

		return null;
	}

	/**
	 * Creates a functioning command context, with data filled in based on what data is passed
	 * @param {sb.Command} commandData
	 * @param {Object|Context} [contextData]
	 * @param {Object} [extraData]
	 * @returns {Context}
	 */
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

		return (string.startsWith(prefix) && string.trim().length > prefix.length);
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

		return new RegExp(`^${body}`);
	}

	static get prefix () {
		return Command.getPrefix();
	}

	static set prefix (value) {
		Command.setPrefix(value);
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
 * @property {Object} [meta] Any other information passed back from the command execution
 * @property {boolean} [partialExecute] Determines if a command is used as a part of a different meta-command
 * @property {boolean} [hasExternalInput] Determines if a command can have arbitrary input - used for the "external prefix" symbol
 * @property {boolean} [skipExternalPrefix] If `hasExternalInput` is true, this flag can override it and remove the symbol
 * @property {boolean} [replyWithPrivateMessage] If true, the command reply should be sent via PMs
 * @property {boolean} [removeEmbeds] Determines if the command response should be embed or not
 * @property {boolean} [keepWhitespace] If true, the command's response will not be automatically stripped from whitespace
 */

/**
 * @typedef {Object} CommandContext
 * @property {string} invocation Exact command name used for invocation - name or alias
 * @property {sb.User} user Data about the user who invoked the command
 * @property {sb.Channel} channel Data about the channel where the command was invoked
 * @property {sb.Command} command Data about the command being invoked
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
 * @property {boolean} useParams If true, all arguments in form of key:value will be parsed into an object
 * @property {boolean} nonNullable If true, the command cannot be directly piped into the null command
 * @property {boolean} externalInput If true, the command is marked as being able to receive aribtrary user input - used in meta-commands
 */

/**
 * @typedef {Object} CommandParameterDefinition
 * @property {string} name Parameter name, as it will be used in execution
 * @property {"string"|"number"|"boolean"|"date"|"object"|"regex"} type Parameter type - string value will be parsed into this type
 */

/**
 *  @typedef {"any"|"all"|"array"} UserPermissionResultType
 */
