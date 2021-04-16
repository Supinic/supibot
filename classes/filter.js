/**
 * Represents a filter of the bot's commands.
 * @memberof sb
 * @type Filter
 */
module.exports = class Filter extends require("./template.js") {
	#filterData = null;

	constructor (data) {
		super();

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
		 * Specific command identifier - a possible command alias
		 * @type {string|null}
		 */
		this.Invocation = data.Invocation;

		/**
		 * Filter type.
		 * Blacklist disallows the usage for given combination of User_Alias/Channel/Command.
		 * Whitelist disallows the usage of a command everywhere BUT the given combination of User_Alias/Channel.
		 * Opt-out disallows the usage of given user as the parameter for given command.
		 * @type {FilterType}
		 */
		this.Type = data.Type;

		/**
		 * Specific filter data, usually only applicable to Cooldown and Arguments filter types.
		 * @type {CooldownFilterData|ArgumentsFilterData}
		 */
		this.Data = null;
		if (data.Data) {
			if (typeof data.Data === "string") {
				try {
					this.Data = JSON.parse(data.Data);
				}
				catch (e) {
					console.warn("Could not parse filter data", {
						error: e,
						filter: this.ID
					});
					this.Data = {};
				}
			}
			else if (typeof data.Data === "object") {
				this.Data = { ...data.Data };
			}
			else {
				console.warn("Unexpected filter data type", {
					data: data.Data,
					type: typeof data.Data,
					filter: this.ID
				});
				this.Data = {};
			}
		}

		if (this.Data) {
			if (this.Type === "Args") {
				if (!this.Data.args) {
					console.warn("Invalid Args filter - missing args object");
				}
				else {
					this.#filterData = [];

					for (const arg of this.Data.args) {
						const obj = {};
						if (i.type === "regex") {
							obj.regex = new RegExp(i.value[0], i.value[1] ?? "");
						}
						else if (i.type === "string") {
							obj.string = i.value;
						}
						else {
							console.warn("Invalid filter Args item - type", { arg, filter: this.ID });
							continue;
						}

						if (typeof i.index === "number") {
							obj.index = i.index;
							obj.range = [];
						}
						else if (Array.isArray(i.range === "number")) {
							obj.range = [...i.range].slice(0, 2);
						}
						else if (typeof i.range === "string") {
							obj.range = i.range.split("..").map(Number).slice(0, 2);
						}
						else {
							console.warn("Invalid filter Args item - index", { arg, filter: this.ID });
							continue;
						}

						this.#filterData.push(obj);


						console.warn("Invalid filter data - missing Args data", { filter: this.ID, data: this.Data });
					}
				}
			}
			else if (this.Type === "Cooldown") {
				const { multiplier, override } = this.Data;
				if (typeof multiplier !== "number" && typeof override !== "number") {
					console.warn("Invalid Cooldown filter - missing multiplier/override");
				}
				else if (typeof multiplier === "number" && typeof override === "number") {
					console.warn("Invalid Cooldown filter - using both multiplier and override");
				}
				else {
					this.#filterData = { ...this.Data };
				}
			}
		}

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

	/**
	 * For custom-data-related Filters, this method applies filter data to the provided data object.
	 * @param {Array|number} data
	 * @returns {*} Returned type depends on filter type - Args {boolean} or Cooldown {number}
	 */
	applyData (data) {
		if (this.Type === "Args" && Array.isArray(data)) {
			for (const item of this.#filterData) {
				const { index, range, regex, string } = item;
				for (let i = 0; i < data.length; i++) {
					const positionCheck = (i === index || (range[0] <= index && index <= range[1]));
					const valueCheck = ((string && data[i] === string) || (regex && data[i].test(regex)));
					if (positionCheck && valueCheck) {
						return true;
					}
				}
			}
		}
		else if (this.Type === "Cooldown" && typeof data === "number") {
			if (typeof this.#filterData.override === "number") {
				return this.#filterData.override;
			}
			else if (typeof this.#filterData.multiplier === "number") {
				return Math.round(data * this.#filterData.multiplier);
			}
		}

		throw new sb.Error({
			message: "Invalid combination of input data and filter type"
		});
	}

	get priority () {
		let priority = 0;
		if (this.Platform) {
			priority |= 0b0000_0001;
		}
		if (this.Channel) {
			priority |= 0b0000_0010;
		}
		if (this.Command) {
			priority |= 0b0000_0100;
		}
		if (this.Invocation) {
			priority |= 0b0000_1000;
		}
		if (this.User_Alias) {
			priority |= 0b0001_0000;
		}

		return priority;
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

	async serialize () {
		throw new sb.Error({
			message: "Module Filter cannot be serialized"
		});
	}

	/**
	 * Pushes a property change to the dataabse.
	 * @param {string} property
	 * @param {*} [value]
	 * @returns {Promise<void>}
	 */
	async saveProperty (property, value) {
		const row = await sb.Query.getRow("chat_data", "Filter");
		await row.load(this.ID);

		await super.saveRowProperty(row, property, value, this);
	}

	static async loadData () {
		const data = await sb.Query.getRecordset(rs => rs
			.select("*")
			.from("chat_data", "Filter")
		);

		Filter.data = data.map(record => new Filter(record));
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

	static getLocals (type, options) {
		return Filter.data.filter(row => (
			row.Active
			&& (!type || type === row.Type)
			&& (options.skipUserCheck || (row.User_Alias === (options.user?.ID ?? null) || row.User_Alias === null))
			&& (row.Channel === (options.channel?.ID ?? null) || row.Channel === null)
			&& (row.Command === (options.command?.ID ?? null) || row.Command === null)
			&& (row.Invocation === (options.invocation ?? null) || row.Invocation === null)
			&& (row.Platform === (options.platform?.ID ?? null) || row.Platform === null)
		));
	}

	/**
	 * Executes all possible filters for the incoming combination of parameters
	 * @param options
	 * @returns {Promise<Object>}
	 */
	static async execute (options) {
		const { command, targetUser, user } = options;
		if (user.Data?.administrator) {
			return { success: true };
		}

		let userTo = null;
		const channel = options.channel ?? Symbol("private-message");
		const localFilters = Filter.getLocals(null, options);

		if (command.Flags.whitelist) {
			const whitelist = localFilters.find((
				i => i.Type === "Whitelist"
				&& (i.User_Alias === user.ID || i.User_Alias === null)
			));

			if (!whitelist) {
				return {
					success: false,
					reason: "whitelist",
					filter:  { Reason: "Reply" },
					reply: command.Whitelist_Response ?? null
				};
			}
		}

		if ((command.Flags.optOut || command.Flags.block) && targetUser) {
			userTo = await sb.User.get(targetUser);
		}

		if (command.Flags.optOut && userTo) {
			const optout = localFilters.find(i => (
				i.Type === "Opt-out"
				&& i.User_Alias === userTo.ID
			));

			if (optout) {
				const targetType = (optout.Invocation) ? "command invocation" : "command";
				return {
					success: false,
					reason: "opt-out",
					filter: optout,
					reply: (optout.Response === "Auto")
						? `🚫 That user has opted out from being the target of your ${targetType}!`
						: (optout.Response === "Reason")
							? optout.Reason
							: null
				};
			}
		}

		if (command.Flags.block && userTo) {
			const userFrom = user;
			const block = localFilters.find(i => (
				i.Type === "Block"
				&& i.User_Alias === userTo.ID
				&& (i.Blocked_User === userFrom.ID || i.Blocked_User === null)
			));

			if (block) {
				const targetType = (block.Invocation) ? "command invocation" : "command";
				return {
					success: false,
					reason: "block",
					filter: block,
					reply: (block.Response === "Auto")
						? `🚫 That user has opted out from being the target of your ${targetType}!`
						: (block.Response === "Reason")
							? block.Reason
							: null
				};
			}
		}

		const blacklist = localFilters.find(i => (
			i.Type === "Blacklist"
			&& (i.User_Alias === user.ID || i.User_Alias === null)
		));

		if (blacklist) {
			let reply = null;
			if (blacklist.Response === "Reason") {
				reply = blacklist.Response;
			}
			else if (blacklist.Response === "Auto") {
				if (blacklist.Channel && blacklist.User_Alias && blacklist.Command && blacklist.Invocation) {
					reply = "You cannot execute this command invocation in this channel.";
				}
				else if (blacklist.Channel && blacklist.User_Alias && blacklist.Command) {
					reply = "You cannot execute this command in this channel.";
				}
				else if (blacklist.Channel && blacklist.Command) {
					reply = "This command cannot be executed in this channel.";
				}
				else if (blacklist.Channel && blacklist.User_Alias) {
					reply = "You cannot execute any commands in this channel.";
				}
				else if (blacklist.User_Alias && blacklist.Command && blacklist.Invocation) {
					reply = "You cannot execute this command invocation in any channel.";
				}
				else if (blacklist.User_Alias && blacklist.Command) {
					reply = "You cannot execute this command in any channel.";
				}
				else if (blacklist.User_Alias) {
					reply = "You cannot execute any commands in any channel.";
				}
				else if (blacklist.Command && blacklist.Invocation) {
					reply = "This command invocation cannot be executed anywhere.";
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

		let channelLive = null;
		if (channel instanceof sb.Channel) {
			const streamData = await channel.getStreamData();
			channelLive = streamData.live ?? false;
		}

		const offlineOnly = localFilters.find(i => i.Type === "Offline-only");
		if (offlineOnly && channelLive === true) {
			const targetType = (offlineOnly.Invocation) ? "command invocation" : "command";
			return {
				success: false,
				reason: "offline-only",
				filter: offlineOnly,
				reply: (offlineOnly.Response === "Auto")
					? `🚫 This ${targetType} is only available when the channel is offline!`
					: (offlineOnly.Response === "Reason")
						? offlineOnly.Reason
						: null
			};
		}

		const onlineOnly = localFilters.find(i => i.Type === "Online-only");
		if (onlineOnly && channelLive === false) {
			const targetType = (onlineOnly.Invocation) ? "command invocation" : "command";
			return {
				success: false,
				reason: "online-only",
				filter: onlineOnly,
				reply: (onlineOnly.Response === "Auto")
					? `🚫 This ${targetType} is only available when the channel is online!`
					: (onlineOnly.Response === "Reason")
						? onlineOnly.Reason
						: null
			};
		}

		return { success: true };
	}

	/**
	 * Creates a new filter record.
	 * @param {Object} options
	 * @param {number} [options.Platform]
	 * @param {number} [options.Channel]
	 * @param {number} [options.Command]
	 * @param {number} [options.User_Alias]
	 * @param {string} [options.Reason]
	 * @param {string} [options.Invocation]
	 * @param {Object} [options.Data]
	 * @param {FilterType} [options.Type]
	 * @param {number} [options.Blocked_User]
	 * @param {number} [options.Issued_By]
	 */
	static async create (options) {
		const data = {
			Platform: options.Platform ?? null,
			Channel: options.Channel ?? null,
			Command: options.Command ?? null,
			User_Alias: options.User_Alias ?? null,
			Reason: options.Reason ?? null,
			Invocation: options.Invocation ?? null,
			Data: options.Data ?? null,
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

	static getMentionStatus (options) {
		const filters = Filter.getLocals("Unmention", {
			...options,
			channel: options.channel ?? Symbol("private-message")
		})

		return (filters.length === 0);
	}

	/**
	 * Executes a unping process on a given string for a given command.
	 * For each user that has decided to "unping" from a given command, their name will be replaced by a string
	 * where on the second position a zero-width character is inserted. This makes sure that they won't be so-called
	 * "pinged", aka notified based on a regex.
	 * @param {Object} options
	 */
	static async applyUnping (options) {
		const filters = Filter.getLocals("Unping",  {
			...options,
			skipUserCheck: true
		});

		let { string } = options;
		const unpingUsers = await sb.User.getMultiple(filters.map(i => i.User_Alias));
		for (const user of unpingUsers) {
			const regex = new RegExp(String.raw `(^|[,:;\s]+)(${user.Name})([,:;\s]|$)`, "gi");
			string = string.replace(regex, (match, prefix, name, suffix) => (
				`${prefix}${name[0]}\u{E0000}${name.slice(1)}${suffix}`
			));
		}

		return string;
	}

	static getCooldownAdjustments (options) {
		const filters = Filter.getLocals("Cooldown", options).sort((a, b) => b.priority - a.priority);
		return filters[0] ?? null;
	}

	static async getFlags (options) {
		return Filter.getLocals("Flags", options);
	}

	static async reloadSpecific (...list) {
		if (list.length === 0) {
			return false;
		}

		const promises = list.map(async (ID) => {
			const row = await sb.Query.getRow("chat_data", "Filter");
			await row.load(ID);

			const existingIndex = Filter.data.findIndex(i => i.ID === ID);
			if (existingIndex !== -1) {
				Filter.data[existingIndex].destroy();
				Filter.data.splice(existingIndex, 1);
			}

			if (!row.values.Active) {
				return;
			}

			const banphrase = new Filter(row.valuesObject);
			Filter.data.push(banphrase);
		});

		await Promise.all(promises);
		return true;
	}
};

/**
 * @typedef {Object} CooldownFilterData
 * @property {number} multiplier - mutually exclusive with `override`
 * @property {number} override - mutually exclusive with `multiplier`
 */

/**
 * @typedef {Object} ArgumentsFilterData
 * @todo
 */

/**
 * @typedef {
 *   "Blacklist","Whitelist","Opt-out","Block",
 *   "Unping","Unmention","Cooldown","Flags",
 *   "Offline-only","Online-only","Args"
 * } FilterType
 */