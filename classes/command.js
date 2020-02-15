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
				console.log("Command" + this.ID + " has invalid aliases definition: " + e.toString());
				sb.SystemLogger.send("Command.Error", "Command " + this.Name + " (" + this.ID + ") has invalid aliases definition: " + e.toString() + "\n" + e.stack);
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
			 * Determines if command is rollbackable.
			 * If true, all sensitive database operations will be handled in a transaction - provided in options object
			 * @type {boolean}
			 */
			this.Rollbackable = data.Rollbackable;

			/**
			 * If true, command result will not be checked for banphrases.
			 * Mostly used for system or simple commands.
			 * @type {boolean}
			 */
			this.Skip_Banphrases = data.Skip_Banphrases;

			/**
			 * If true, command is only accessible to certain users or channels, or their combination.
			 * @type {boolean}
			 */
			this.Whitelisted = data.Whitelisted;

			/**
			 * If not null, specified the response for a whitelisted command when invoked outside of the whitelist.
			 * @type {boolean}
			 */
			this.Whitelist_Response = data.Whitelist_Response;

			/**
			 * If true, command is guaranteed to not reply, and as such, no banphrases, cooldowns or pings are checked.
			 * @type {boolean}
			 */
			this.Read_Only = data.Read_Only;

			/**
			 * If true, any user can "opt-out" from being the target of the command.
			 * @example A user can opt-out from command randomline, and nobody will be able to use it with them as the parameter.
			 * @type {boolean}
			 */
			this.Opt_Outable = data.Opt_Outable;

			/**
			 * If true, any user can "block" another user from targetting them with this command.
			 * @example A user can opt-out from command remind for user XYZ. User XYZ will no longer be able to remind the user.
			 * @type {boolean}
			 */
			this.Blockable = data.Blockable;

			/**
			 * If true, the command can be used as a part of the "pipe" command.
			 * @type {boolean}
			 */
			this.Pipeable = data.Pipeable;

			/**
			 * If true, command will attempt to ping its invoker. This also requires the channel to have this option enabled.
			 * @type {boolean}
			 */
			this.Ping = data.Ping;

			try {
				data.Code = eval(data.Code);
			}
			catch (e) {
				console.log("Command" + this.ID + " has invalid code definition: " + e.toString());
				sb.SystemLogger.send("Command.Error", "Command " + this.Name + " (" + this.ID + ") has invalid code definition: " + e.toString() + "\n" + e.stack);
				data.Code = async () => ({ reply: "Command has invalid code definition!" });
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
			Command.data = (await sb.Query.getRecordset(rs => rs
				.select("*")
				.from("chat_data", "Command")
				.where("Archived = %b", false)
			)).map(record => new Command(record));
		}

		static async reloadData () {
			Command.data = [];
			await Command.loadData();
		}

		static async reloadSpecific (...list) {
			const reloadingCommands = list.map(i => Command.get(i)).filter(Boolean);
			const data = await sb.Query.getRecordset(rs => rs
				.select("*")
				.from("chat_data", "Command")
				.where("ID IN %n+", reloadingCommands.map(i => i.ID))
				.where("Archived = %b", false)
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

			const prefixRegex = new RegExp("^\\" + sb.Config.get("COMMAND_PREFIX"));
			identifier = identifier.replace(prefixRegex, "");

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

			const accessBlocked = sb.Filter.check({
				userID: userData.ID,
				channelID: channelID,
				commandID: command.ID
			});
			if (accessBlocked) {
				const reply = (command.Whitelisted && command.Whitelist_Response)
					? command.Whitelist_Response
					: (typeof accessBlocked === "string")
						? accessBlocked
						: null;

				sb.CooldownManager.unsetPending(userData.ID);
				sb.CooldownManager.set(channelID, userData.ID, command.ID, command.Cooldown);
				sb.Runtime.incrementRejectedCommands();

				return {
					success: false,
					reason: "filter",
					reply: reply
				};
			}

			// Check for blocked users
			if (command.Blockable && argumentArray[0]) {
				const block = await sb.Filter.checkBlocks(userData.ID, argumentArray[0], command.ID);

				// If the user has blocked the person, disallow the usage of command.
				if (block) {
					const reply = (typeof block === "string")
						? (await sb.Banphrase.execute(block, channelData)).string
						: null;

					sb.CooldownManager.unsetPending(userData.ID);
					sb.CooldownManager.set(channelID, userData.ID, command.ID, command.Cooldown);

					return {
						success: false,
						reason: "block",
						reply
					};
				}
			}

			// Check for opted out users
			if (command.Opt_Outable && argumentArray[0]) {
				const optout = await sb.Filter.checkOptOuts(argumentArray[0], command.ID);

				// If the user is opted out AND the requesting user does not have an override, then return immediately.
				if (optout && !userData.Data.bypassOptOuts) {
					const reply = (typeof optout === "string")
						? (await sb.Banphrase.execute(optout, channelData)).string
						: null;

					sb.CooldownManager.unsetPending(userData.ID);
					sb.CooldownManager.set(channelID, userData.ID, command.ID, command.Cooldown);

					return {
						success: false,
						reason: "opt-out",
						reply
					};
				}
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
			if (command.Rollbackable) {
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
					Result: (typeof execution?.reply === "string")
						? execution.reply.slice(0, 300)
						: null,
					Execution_Time: sb.Utils.round(Number(end - start) / 1.0e6, 3)
				});
			}
			catch (e) {
				console.error(e);
				const errorID = await sb.SystemLogger.sendError("Command", e, ...args);

				execution = {
					success: false,
					reason: "error",
					reply: "An internal error occured! Error ID: " + errorID
				};
			}

			// Read-only commands never reply with anything - banphrases, pings and cooldowns are not checked
			if (command.Read_Only) {
				return {success: !!execution.success};
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
							const {string} = await sb.Banphrase.execute(message, channelData);
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

				if (command.Ping && channelData?.Ping) {
					// @todo maybe {passed, string} is better in case the name is too bad? We'll see later on
					const {string} = await sb.Banphrase.execute(userData.Name, channelData);
					execution.reply = string + ", " + execution.reply;
				}

				const unpingUsers = await sb.User.getMultiple(sb.Filter.data
					.filter(i => i.Active && i.Command === command.ID && i.Type === "Unping")
					.map(i => i.User_Alias)
				);
				for (const unpingUser of unpingUsers) {
					const fixedName = unpingUser.Name[0] + `\u{E0000}` + unpingUser.Name.slice(1);
					const regex = new RegExp(unpingUser.Name, "g");
					execution.reply = execution.reply.replace(regex, fixedName);
				}

				const metaSkip = Boolean(execution.meta && execution.meta.skipBanphrases);
				if (!command.Skip_Banphrases && !metaSkip) {
					const {passed, string} = await sb.Banphrase.execute(execution.reply.slice(0, 1000), channelData);
					execution.reply = string;

					if (command.Rollbackable) {
						if (passed) {
							data.transaction.commit();
						}
						else {
							data.transaction.rollback();
						}
					}
				}
				else if (command.Rollbackable) {
					data.transaction.commit();
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

			if (typeof cooldownData !== "undefined") {
				if (cooldownData !== null) {
					if (!Array.isArray(cooldownData)) {
						cooldownData = [cooldownData];
					}

					for (const cooldown of cooldownData) {
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