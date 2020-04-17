/* global sb */
module.exports =  (function () {
	"use strict";

	/**
	 * Represents a filter of the bot's commands.
	 * @memberof sb
	 * @type Filter
	 */
	return class Filter {
		/**  @type {sb.Filter} */
		constructor (data) {
			/**
			 * Unique numeric identifier
			 * @type {number}
			 */
			this.ID = data.ID;

			/**
			 * Unique numeric user identifier
			 * @type {User.ID|null}
			 */
			this.User_Alias = data.User_Alias;

			/**
			 * Unique numeric channel identifier
			 * @type {Channel.ID|null}
			 */
			this.Channel = data.Channel;

			/**
			 * Unique numeric command identifier
			 * @type {Command.ID|null}
			 */
			this.Command = data.Command;

			/**
			 * Unique numeric platform identifier
			 * @type {Platform.ID|null}
			 */
			this.Platform = data.Platform;

			/**
			 * Filter type.
			 * Blacklist disallows the usage for given combination of User_Alias/Channel/Command.
			 * Whitelist disallows the usage of a command everywhere BUT the given combination of User_Alias/Channel.
			 * Opt-out disallows the usage of given user as the parameter for given command.
			 * @type {"Blacklist"|"Whitelist"|"Opt-out"}
			 */
			this.Type = data.Type;

			/**
			 * Response type to respond with if a filter is found.
			 * @type {"None"|"Auto"|"Reason"}
			 */
			this.Response = data.Response;

			/**
			 * The reason a filter was issued.
			 * @type {string|null}
			 */
			this.Reason = data.Reason;

			/**
			 * If the filter is a block, this is the user who is being blocked from targetting someone with a command.
			 * @type {User.ID|null}
			 */
			this.Blocked_User = data.Blocked_User;

			/**
			 * Whether or not the filter is currently being enforced.
			 * @type {boolean}
			 */
			this.Active = data.Active;

			/**
			 * Unique numeric user identifier of the person who created the filter.
			 * @type {User.ID|null}
			 */
			this.Issued_By = data.Issued_By;
		}

		async toggle () {
			this.Active = !this.Active;
			const row = await sb.Query.getRow("chat_data", "Filter");
			await row.load(this.ID);
			row.values.Active = this.Active;
			await row.save();
		}

		/**
		 * Changes the reason and response fields of a Filter accordingly.
		 * @param {string|null} reason Changes the reason of the filter and the type to "Reason" if set to string.
		 * Unsets the response (NULL) and sets the type to "Auto"
		 * @returns {Promise<void>}
		 */
		async setReason (reason) {
			if (typeof reason === "string") {
				this.Reason = reason;
				this.Response = "Reason";
			}
			else if (reason === null) {
				this.Reason = null;
				this.Response = "Auto";
			}
			else {
				throw new sb.Error({
					message: "Invalid reason type",
					args: {
						type: typeof reason
					}
				})
			}

			const row = await sb.Query.getRow("chat_data", "Filter");
			await row.load(this.ID);

			row.values.Reason = this.Reason;
			row.values.Response = this.Response;

			await row.save();
		}

		/** @override */
		static async initialize () {
			await Filter.loadData();
			return Filter;
		}

		static async loadData () {
			Filter.data = (await sb.Query.getRecordset(rs => rs
				.select("*")
				.from("chat_data", "Filter")
			)).map(record => new Filter(record));
		}

		static async reloadData () {
			Filter.data = [];
			await Filter.loadData();
		}

		static get (identifier) {
			if (identifier instanceof Filter) {
				return identifier;
			}
			else if (typeof identifier === "number") {
				return Filter.data.find(i => i.ID === identifier);
			}
			else {
				throw new sb.Error({
					message: "Unrecognized filter identifier type",
					args: typeof identifier
				});
			}
		}

		static async execute (options) {
			const { command, platform, user, targetUser } = options;
			if (user.Data?.administrator) {
				return { success: true };
			}

			let userTo = null;
			const channel = options.channel ?? Symbol("private-message");
			const localFilters = Filter.data.filter(row => (
				row.Active
				&& (row.Channel === (channel?.ID ?? null) || row.Channel === null)
				&& (row.Command === (command?.ID ?? null) || row.Command === null)
				&& (row.Platform === (platform?.ID ?? null) || row.Platform === null)
			));

			if (command.Whitelisted) {
				const whitelist = localFilters.find((
					i => i.Type === "Whitelist"
					&& (i.User_Alias === user.ID || i.User_Alias === null)
				));

				if (!whitelist) {
					return {
						success: false,
						reason: "whitelist",
						filter: whitelist,
						reply: command.Whitelist_Response ?? null
					};
				}
			}

			if ((command.Opt_Outable || command.Blockable) && targetUser) {
				userTo = await sb.User.get(targetUser);
			}

			if (command.Opt_Outable && userTo) {
				const optout = localFilters.find(i => (
					i.Type === "Opt-out"
					&& i.User_Alias === userTo.ID
				));

				if (optout) {
					return {
						success: false,
						reason: "opt-out",
						filter: optout,
						reply: (optout.Response === "Auto")
							? "🚫 That user has opted out from being the command target!"
							: (optout.Response === "Reason")
								? optout.Reason
								: null
					};
				}
			}
			if (command.Blockable && userTo) {
				const userFrom = user;
				const block = localFilters.find(i => (
					i.Type === "Block"
					&& i.User_Alias === userTo.ID
					&& i.Blocked_User === userFrom.ID
				));

				if (block) {
						return {
							success: false,
							reason: "block",
							filter: block,
							reply: (block.Response === "Auto")
								? "🚫 That user has opted out from being the target of your command!"
								: (block.Response === "Reason")
									? block.Reason
									: null
						};
					}
			}

			const blacklist = localFilters.find(i => (
				i.Type === "Blacklist"
				&& i.User_Alias === user.ID
			));

			if (blacklist) {
				let reply = null;
				if (blacklist.Response === "Reason") {
					reply = blacklist.Response;
				}
				else {
					if (blacklist.Channel && blacklist.Command && blacklist.User_Alias) {
						reply = "You cannot execute that command in this channel.";
					}
					else if (blacklist.Channel && blacklist.Command) {
						reply = "This command cannot be executed in this channel.";
					}
					else if (blacklist.Channel && blacklist.User_Alias) {
						reply = "You cannot execute any commands in this channel.";
					}
					else if (blacklist.User_Alias && blacklist.Command) {
						reply = "You cannot execute this command in any channel.";
					}
					else if (blacklist.User_Alias) {
						reply = "You cannot execute any commands in any channel.";
					}
					else if (blacklist.Command) {
						reply = "This command cannot be executed anywhere.";
					}
					else if (blacklist.Channel) {
						reply = "No commands can be executed in this channel.";
					}
					else {
						throw new sb.Error({
							message: "Unrecognized filter configuration", args: blacklist
						});
					}
				}

				return {
					success: false,
					reason: "blacklist",
					filter: blacklist,
					reply
				}
			}

			return { success: true };
		}

		/**
		 * Checks if a given collection of arguments is being disallowed.
		 * @param {FilterCheckOptions} options
		 * @returns {boolean|string} If false, no filters were found. If truthy, a filter exists. If string, specifies the reason of the filter.
		 */
		static check (options) {
			return Filter.checkBlacklists(options) || Filter.checkWhitelists(options) || false;
		}

		/**
		 * Checks blacklists for given combination of parameters.
		 * @param {FilterCheckOptions} options
		 * @returns {boolean|string}
		 * @throws {sb.Error} If an invalid filter configuration is encountered.
		 */
		static checkBlacklists (options) {
			const { userID, channelID, commandID } = options;
			const blacklists = Filter.data.filter(i => i.Active && i.Type === "Blacklist");
			const blacklist = blacklists.find(filter => {
				if (filter.User_Alias === userID) {
					return Boolean(
						(filter.Channel === null || filter.Channel === channelID) &&
						(filter.Command === null || filter.Command === commandID)
					);
				}
				else if (filter.Channel === channelID) {
					return Boolean(
						(filter.User_Alias === null || filter.User_Alias === userID) &&
						(filter.Command === null || filter.Command === commandID)
					);
				}
				else if (filter.Command === commandID) {
					return Boolean(
						(filter.Channel === null || filter.Channel === channelID) &&
						(filter.User_Alias === null || filter.User_Alias === userID)
					);
				}
				return false;
			});

			if (!blacklist) {
				return false;
			}
			else if (blacklist.Response === "None") {
				return true;
			}
			else if (blacklist.Response === "Reason" && blacklist.Reason) {
				return blacklist.Reason;
			}
			else {
				if (blacklist.Channel && blacklist.Command && blacklist.User_Alias) {
					return "You cannot execute that command in this channel.";
				}
				else if (blacklist.Channel && blacklist.Command) {
					return "This command cannot be executed in this channel.";
				}
				else if (blacklist.Channel && blacklist.User_Alias) {
					// Impound a heavy cooldown for the user, as they are filterned channel-wide
					sb.CooldownManager.set(
						channelID,
						userID,
						null,
						60 * 60_000
					);

					return "You cannot execute any commands in this channel.";
				}
				else if (blacklist.User_Alias && blacklist.Command) {
					return "You cannot execute this command in any channel.";
				}
				else if (blacklist.User_Alias) {
					// Impound a heavy cooldown for the user, as they are filterned bot-wide
					sb.CooldownManager.set(
						null,
						userID,
						null,
						60 * 60_000
					);
					return "You cannot execute any commands in any channel.";
				}
				else if (blacklist.Command) {
					return "This command cannot be executed anywhere.";
				}
				else if (blacklist.Channel) {
					return "No commands can be executed in this channel.";
				}
				else {
					throw new sb.Error({
						message: "Unrecognized filter configuration",
						args: blacklist
					});
				}
			}
		}

		/**
		 * Checks whitelists for given combination of parameters.
		 * @param {FilterCheckOptions} options
		 * @returns {boolean|string}
		 * @throws {sb.Error} If an invalid filter configuration is encountered.
		 */
		static checkWhitelists (options) {
			const {userID, channelID, commandID} = options;
			const command = sb.Command.get(commandID);

			// If a command is not whitelisted, nothing needs to be checked here.
			if (!command.Whitelisted) {
				return false;
			}

			const whitelists = Filter.data.filter(i => i.Active && i.Type === "Whitelist" && i.Command === commandID);
			const whitelist = whitelists.find(filter => {
				if (filter.User_Alias === userID) {
					return Boolean(filter.Channel === null || filter.Channel === channelID);
				}
				if (filter.Channel === channelID) {
					return Boolean(filter.User_Alias === null || filter.User_Alias === userID);
				}
				return false;
			});

			// If a whitelist was found, then the invocation was permitted => result is false (no filter found).
			// Otherwise, the invocation was outside of the whitelist, and is not permitted => result is true (filtered).
			return !whitelist;
		}

		/**
		 * Checks opt-outs for given combination of parameters.
		 * Used in specific commands' definitions, to check
		 * @param {string} user
		 * @param {number} commandID
		 * @returns {boolean|string}
		 */
		static async checkOptOuts (user, commandID) {
			if (!user || !commandID) {
				return false;
			}

			const userData = await sb.User.get(user, true);
			if (!userData) {
				return false;
			}
			else if (userData.Data.universalOptOut === true) {
				return "That user is opted out globally!";
			}

			const optout = Filter.data.find(filter => (
				filter.Active
				&& filter.Type === "Opt-out"
				&& filter.Command === commandID
				&& filter.User_Alias === userData.ID
			));

			if (!optout) {
				return false;
			}
			else if (optout.Response === "None") {
				return true;
			}
			else if (optout.Response === "Reason" && optout.Reason) {
				return optout.Reason;
			}
			else {
				return "That user has opted out from being the command target!";
			}
		}

		/**
		 * Checks opt-outs for given combination of parameters.
		 * Used in specific commands' definitions, to check
		 * @param {string} fromUser
		 * @param {string} toUser
		 * @param {number} commandID
		 * @returns {boolean|string}
		 */
		static async checkBlocks (fromUser, toUser, commandID) {
			if (!fromUser || !toUser || !commandID) {
				return false;
			}

			const [fromUserData, toUserData] = await Promise.all([
				sb.User.get(fromUser, true),
				sb.User.get(toUser, true)
			]);

			if (!fromUserData || !toUserData) {
				return false;
			}

			const block = sb.Filter.data.find(filter => (
				filter.Active
				&& filter.Type === "Block"
				&& filter.Command === commandID
				&& filter.User_Alias === fromUserData.ID
				&& filter.Blocked_User === toUserData.ID
			));

			if (!block) {
				return false;
			}
			else if (block.Response === "None") {
				return true;
			}
			else if (block.Response === "Reason" && block.Reason) {
				return block.Reason;
			}
			else {
				return "That user has opted out from being the target of your command! 🚫";
			}
		}

		/**
		 * Creates a new filter record.
		 * @param {Object} options
		 * @param {number} [options.Channel]
		 * @param {number} [options.Command]
		 * @param {number} [options.User_Alias]
		 * @param {"Blacklist"|"Whitelist"|"Opt-out"} [options.Type]
		 * @param {string} [options.Reason]
		 */
		static async create (options) {
			const data = {
				Platform: options.Platform ?? null,
				Channel: options.Channel ?? null,
				Command: options.Command ?? null,
				User_Alias: options.User_Alias ?? null,
				Reason: options.Reason ?? null,
				Type: options.Type ?? "Blacklist",
				Response: "Auto",
				Blocked_User: options.Blocked_User ?? null,
				Active: true,
				Issued_By: options.Issued_By ?? sb.Config.get("ADMINISTRATOR_USER_ID")
			};

			const row = await sb.Query.getRow("chat_data", "Filter");
			row.setValues(data);
			await row.save();

			data.ID = row.values.ID;
			const filter = new Filter(data);
			Filter.data.push(filter);

			return filter;
		}

		/**
		 * Executes a unping process on a given string for a given command.
		 * For each user that has decided to "unping" from a given command, their name will be replaced by a string
		 * where on the second position a zero-width character is inserted. This makes sure that they won't be so-called
		 * "pinged", aka notified based on a regex.
		 * @param {Command|number|string} commandIdentifier
		 * @param {string} string
		 */
		static async applyUnping (commandIdentifier, string) {
			const { ID: commandID } = sb.Command.get(commandIdentifier);
			const unpingUsers = await sb.User.getMultiple(Filter.data
				.filter(i => i.Active && i.Command === commandID && i.Type === "Unping")
				.map(i => i.User_Alias)
			);

			for (const user of unpingUsers) {
				const fixedName = user.Name[0] + `\u{E0000}` + user.Name.slice(1);
				const regex = new RegExp(user.Name, "gi");
				string = string.replace(regex, fixedName);
			}

			return string;
		}

		/**
		 * Cleans up.
		 */
		static destroy () {
			Filter.data = null;
		}
	};
})();

/**
 * @typedef FilterCheckOptions
 * @property {sb.User.ID|null} userID
 * @property {sb.Channel.ID|null} channelD
 * @property {sb.Command.ID|null} commandID
 */