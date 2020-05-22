/* global sb */
module.exports = (function () {
	"use strict";
	
	const PRIVATE_MESSAGE_CHANNEL_ID = Symbol("private-message-channel");

	/**
	 * Represents a bot command.
	 * @memberof sb
	 * @type Command
	 */
	return class Command {
		/** @alias {Command} */
		constructor (data) {
			/**
			 * Unique numeric ID.
			 * @type {number}
			 */
			this.ID = data.ID;

			/**
			 * Unique command name.
			 * @type {string}
			 */
			this.Name = data.Name;

			try {
				data.Aliases = eval(data.Aliases) || [];
			}
			catch (e) {
				console.warn(`Command ${this.Name} (${this.ID}) has invalid aliases definition: ${e}`);
				data.Aliases = [];
			}

			/**
			 * Array of string aliases. Can be empty if none are provided.
			 * @type {string[]}
			 */
			this.Aliases = data.Aliases;

			/**
			 * Command description. Also used for the help command.
			 * @type {string}
			 */
			this.Description = data.Description;

			/**
			 * Command cooldown, in milliseconds.
			 * @type {number}
			 */
			this.Cooldown = data.Cooldown;

			/**
			 * @typedef {Object} CommandFlagsObject
			 * @property {boolean} rollback Determines if command is rollbackable.
			 * If true, all sensitive database operations will be handled in a transaction - provided in options object.
			 * @property {boolean} optOut If true, any user can "opt-out" from being the target of the command.
			 * If done, nobody will be able to use their username as the command parameter.
			 * @property {boolean} skipBanphrases If true, command result will not be checked for banphrases.
			 * Mostly used for system or simple commands with little or no chance to trigger banphrases.
			 * @property {boolean} block If true, any user can "block" another user from targetting them with this command.
			 * If done, the specified user will not be able to use their username as the command parameter.
			 * Similar to optOut, but not global, and only applies to one user.
			 * @property {boolean} ownerOverride If true, the command's cooldown will be vastly reduced when a user invokes it in their own channel.
			 * @property {boolean} readOnly If true, command is guaranteed to not reply, and as such, no banphrases, cooldowns or pings are checked.
			 * @property {boolean} whitelist If true, command is only accessible to certain users or channels, or their combination.
			 * @property {boolean} pipe If true, the command can be used as a part of the "pipe" command.
			 * @property {boolean} ping If true, command will attempt to "ping" - notify - its invoker.
			 * This also requires the channel to have this option enabled.
			 */

			/**
			 * Holds all flags of a command, all of which are booleans.
			 * This object is frozen after initialization, so that the flags can only be modified outside of runtime.
			 * @type {CommandFlagsObject}
			 */
			this.Flags = {};

			if (data.Flags !== null) {
				for (const flag of data.Flags) {
					const camelFlag = sb.Utils.convertCase(flag, "kebab", "camel");
					this.Flags[camelFlag] = true;
				}
			}

			Object.freeze(this.Flags);

			/**
			 * If not null, specified the response for a whitelisted command when invoked outside of the whitelist.
			 * @type {boolean}
			 */
			this.Whitelist_Response = data.Whitelist_Response;

			try {
				data.Code = eval(data.Code);
			}
			catch (e) {
				console.error(`Command ${this.ID} has invalid code definition!`, e);
				data.Code = async () => ({
					success: false,
					reply: "Command has invalid code definition! Please make sure to let @supinic know about this!"
				});
			}

			/**
			 * Command code.
			 * @type {Function}
			 */
			this.Code = data.Code;

			/**
			 * Session-specific data for the command that can be modified at runtime.
			 * @type {Object}
			 */
			this.data = {};

			/**
			 * Data specific for the command. Usually hosts utils methods, or constants.
			 * The object is deeply frozen, preventing any changes.
			 * @type {Object}
			 */
			this.staticData = {};
			if (data.Static_Data) {
				try {
					this.staticData = sb.Utils.deepFreeze(eval(data.Static_Data));
				}
				catch (e) {
					console.warn(`Command ${this.ID} has invalid static data definition!`, e);
					data.Code = async () => ({ reply: "Command has invalid static data definition!" });
				}
			}
		}

		/**
		 * Destroys the command instance.
		 */
		destroy () {
			this.Code = null;
			this.data = null;
			this.Aliases = null;

			this._destroyed = true;
		}

		/**
		 * Executes the command.
		 * @param {*[]} args
		 * @returns CommandResult
		 */
		execute (...args) {
			return this.Code(...args);
		}

		/** @override */
		static async initialize () {
			await Command.loadData();
			return Command;
		}

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
			if (Command.prefix === null) {
				console.warn("No command prefix configured - bot will not respond to any command queries");
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

		static async reloadData () {
			Command.data = [];
			await Command.loadData();
		}

		/**
		 * Reloads a specific list of commands.
		 * @param {string[]} list
		 * @returns {Promise<void>} True if passed, false if
		 * @throws {sb.Error} If the list contains 0 valid commands
		 */
		static async reloadSpecific (...list) {
			const reloadingCommands = list.map(i => Command.get(i)).filter(Boolean);
			if (reloadingCommands.length === 0) {
				throw new sb.Error({
					message: "No valid commands provided"
				});
			}

			const data = await sb.Query.getRecordset(rs => rs
				.select("*")
				.from("chat_data", "Command")
				.where("ID IN %n+", reloadingCommands.map(i => i.ID))
				.where("Flags NOT %*like* OR Flags IS NULL", "archived")
			);

			for (const record of data) {
				const existingIndex = Command.data.findIndex(i => i.ID === record.ID);
				Command.data[existingIndex].destroy();
				Command.data[existingIndex] = new Command(record);
			}
		}

		/**
		 * Searches for a command, based on its ID, Name or Alias.
		 * Returns immediately if identifier is already a Command.
		 * @param {Command|number|string} identifier
		 * @returns {Command|null}
		 * @throws {sb.Error} If identifier is unrecognized
		 */
		static get (identifier) {
			if (identifier instanceof Command) {
				return identifier;
			}
			else if (typeof identifier === "number") {
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
			const channelID = (channelData?.ID ?? PRIVATE_MESSAGE_CHANNEL_ID);
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
				channel: channelData ?? null,
				platform: channelData?.Platform ?? null,
				targetUser: argumentArray[0] ?? null
			});

			if (!filterData.success) {
				sb.CooldownManager.unsetPending(userData.ID);
				sb.CooldownManager.set(channelID, userData.ID, command.ID, command.Cooldown);
				sb.Runtime.incrementRejectedCommands();

				if (filterData.filter.Response === "Reason" && typeof filterData.reply === "string") {
					const { string } = await sb.Banphrase.execute(filterData.reply, channelData);
					filterData.reply = string;
				}

				return filterData;
			}

			const appendOptions = Object.assign({}, options);
			const isPrivateMessage = Boolean(appendOptions.privateMessage);
			if (typeof appendOptions.privateMessage !== "undefined") {
				// @todo check if Object.fromEntries(Object.entries.map) is faster than delete
				delete appendOptions.privateMessage;
			}

			/** @type ExtraCommandData */
			let data = {
				platform: options.platform,
				invocation: identifier,
				user: userData,
				channel: channelData,
				command: command,
				transaction: null,
				privateMessage: isPrivateMessage,
				append: appendOptions
			};

			// If the command is rollbackable, set up a transaction.
			// The command must use the connection in transaction - that's why it is passed to data
			if (command.Flags.rollback) {
				data.transaction = await sb.Query.getTransaction();
			}

			/** @type CommandResult */
			let execution;
			const args = argumentArray
				.map(i => i.replace(sb.Config.get("WHITESPACE_REGEX"), ""))
				.filter(Boolean);

			try {
				const start = process.hrtime.bigint();
				execution = await command.Code(data, ...args);
				const end = process.hrtime.bigint();

				let result = null;
				if (execution?.reply) {
					result = execution.reply.slice(0, 300);
				}
				else if (execution?.partialReplies) {
					result = execution.partialReplies.map(i => i.message).join(" ").slice(0, 300);
				}

				sb.Runtime.incrementCommandsCounter();
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
					Execution_Time: sb.Utils.round(Number(end - start) / 1.0e6, 3)
				});
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
				else {
					console.error(e);
					const errorID = await sb.SystemLogger.sendError("Command", e, [identifier, ...args]);
					let reply = sb.Utils.tag.trim `
						Command execution resulted in an error! 
						Please report this with the suggest command.
						Include what you were doing and this ID: ${errorID}
					`;

					if (channelData?.ID === 38) {
						reply = `WEEWOO Error: ${e.message} - ID ${errorID} WEEWOO`;
					}

					execution = {
						success: false,
						reason: "error",
						reply
					};
				}
			}

			// Read-only commands never reply with anything - banphrases, pings and cooldowns are not checked
			if (command.Flags.readOnly) {
				return {
					success: execution?.success ?? true
				};
			}

			// This should be removed once all deprecated calls are refactored
			if (channelData && execution?.meta?.skipCooldown === true) {
				console.warn("Deprecated return value - skipCooldown (use cooldown: null instead)", command.ID);
			}

			Command.handleCooldown(channelData, userData, command, execution?.cooldown);

			if (execution && (execution.reply || execution.partialReplies)) {
				if (Array.isArray(execution.partialReplies) && execution.partialReplies.every(i => i && i.constructor === Object)) {
					const partResult = [];
					for (const {message, bancheck} of execution.partialReplies) {
						if (bancheck === true) {
							const {string} = await sb.Banphrase.execute(
								message,
								channelData,
								{ skipBanphraseAPI: true }
							);

							partResult.push(string);
						}
						else {
							partResult.push(message);
						}
					}

					execution.reply = partResult.join(" ");
				}
				else if (execution.partialReplies) {
					throw new sb.Error({
						message: "If set, partialReplies must be an Array of Objects"
					});
				}

				if (typeof execution.reply !== "string") {
					console.warn(`Execution of command ${command.ID} did not result with execution.reply of type string`, {command, execution, data});
				}

				execution.reply = sb.Utils.fixHTML(String(execution.reply));

				if (!execution.meta?.skipWhitespaceCheck) {
					execution.reply = execution.reply.replace(sb.Config.get("WHITESPACE_REGEX"), "");
				}

				if (command.Flags.ping && channelData?.Ping) {
					// @todo maybe {passed, string} is better in case the name is too bad? We'll see later on
					const {string} = await sb.Banphrase.execute(
						userData.Name,
						channelData,
						{ skipBanphraseAPI: true }
					);

					execution.reply = string + ", " + execution.reply;
				}

				const metaSkip = Boolean(options.skipBanphrases || execution?.meta?.skipBanphrases);
				if (!command.Flags.skipBanphrases && !metaSkip) {
					const { passed, privateMessage, string } = await sb.Banphrase.execute(execution.reply.slice(0, 1000), channelData);
					execution.reply = string;

					if (
						(typeof execution.replyWithPrivateMessage !== "boolean" )
						&& (typeof privateMessage == "boolean")
					) {
						execution.replyWithPrivateMessage = privateMessage;
					}

					if (command.Flags.rollback) {
						if (passed) {
							data.transaction.commit();
						}
						else {
							data.transaction.rollback();
						}
					}
				}
				else if (command.Flags.rollback) {
					data.transaction.commit();
				}

				// Apply all unpings to the result, if it is still a string (aka the response should be sent)
				if (typeof execution.reply === "string") {
					execution.reply = await sb.Filter.applyUnping(command, execution.reply);
				}
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
			const channelID = channelData?.ID ?? PRIVATE_MESSAGE_CHANNEL_ID;

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

		/**
		 * Cleans up.
		 */
		static destroy () {
			Command.data = null;
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

		static getPrefix () {
			return sb.Config.get("COMMAND_PREFIX", false) ?? null;
		}

		static setPrefix (value) {
			return sb.Config.set("COMMAND_PREFIX", value);
		}
	};
})();

/**
 * @typedef {Object} CommandResult
 * @property {boolean} success If true, result contains reply; if false, result contains error
 * @property {string} [reply] Command result as a string to reply. If not provided, no message should be sent
 * @property {Object} [cooldown] Dynamic cooldown settings
 * @property {string} [reason] Symbolic description of why command execution failed - used internally
 * @property {Object} [meta] Any other information passed back from the commend execution
 */

/**
 * @typedef {Object} ExtraCommandData
 * @property {string} invocation Exact command name used for invocation - name or alias
 * @property {User} user Data about the user who invoked the command
 * @property {Channel} channel Data about the channel where the command was invoked
 * @property {Command} command Data about the command being invoked
 * @property {Object} append = {} other platform-specific options
 * @property {?} [transaction] For rollbackable commands, a transaction is set up and later committed/rollbacked.
 * Commands must use this.data.transaction for whatever sbase access should be safeguarded.
 */