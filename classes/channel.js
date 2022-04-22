/**
 * Represents a chat channel.
 */
module.exports = class Channel extends require("./template.js") {
	static redisPrefix = "sb-channel";

	/** @type {WeakMap<Channel, Map<string, *>>} */
	static dataCache = new WeakMap();

	constructor (data) {
		super();

		/**
		 * Unique numeric ID.
		 * @type {number}
		 */
		this.ID = data.ID;

		/**
		 * Channel name. Must be unique in the scope of its {@link sb.Platform}.
		 * @type {string}
		 */
		this.Name = data.Name;

		/**
		 * Platform object the channel belongs to.
		 * @type {sb.Platform}
		 */
		this.Platform = sb.Platform.get(data.Platform);

		/**
		 * Platform-specific ID. Used in Discord and Twitch, for example.
		 * @type {string|null}
		 */
		this.Specific_ID = data.Specific_ID || null;

		/**
		 * Channel mode - determines bot behaviour.
		 * Inactive - will not attempt to join, and will ignore every data and chat messages or commands.
		 * Read - will ignore all command requests.
		 * Write - normal mode, channel cooldown set at 1250 milliseconds - normalized for Twitch.
		 * VIP - elevated mode, channel cooldown set at 250 milliseconds - using the VIP mode, but also not spamming too much.
		 * Moderator - super mode, channel cooldown set at 50 milliseconds - only used in channels where it is OK to spam.
		 * @type {("Inactive"|"Read"|"Write"|"VIP"|"Moderator")}
		 */
		this.Mode = data.Mode;

		/**
		 * If true, commands that are configured to mention the invoking user will do so.
		 * If false, no mentions will be added.
		 * @type {boolean}
		 */
		this.Mention = data.Mention;

		/**
		 * If true, all links that would otherwise be sent will be replaced with a placeholder string.
		 * @type {boolean}
		 */
		this.Links_Allowed = data.Links_Allowed;

		/**
		 * Type of banphrase API.
		 * If not null and {@link sb.Channel.Banphrase_API_URL} is also not null, all messages will be also checked against this banphrase API
		 * @type {string|null}
		 */
		this.Banphrase_API_Type = data.Banphrase_API_Type;

		/**
		 * URL of banphrase API.
		 * If not null and {@link sb.Channel.Banphrase_API_Type} is also not null, all messages will be also checked against this banphrase API
		 * @type {string|null}
		 */
		this.Banphrase_API_URL = data.Banphrase_API_URL;

		/**
		 * Bot behaviour when given banphrase API is not available (downtime).
		 * Ignore = Pretend as if the API was not there. Post messages as normal.
		 * Notify = As Ignore, but prepend a warning message that the API is unreachable.
		 * Refuse = Do not post the message at all, post a warning message instead.
		 * (null) = Default value for channels that have no banphrase API set up.
		 * @type {"Ignore"|"Notify"|"Refuse"|"Nothing"|"Whisper"|null}
		 */
		this.Banphrase_API_Downtime = data.Banphrase_API_Downtime;

		/**
		 * Channel-specific character limit for any message sent in it.
		 * If null, uses a global platform-specific setting instead.
		 * @type {number|null}
		 */
		this.Message_Limit = data.Message_Limit;

		/**
		 * Flag specifying channel's NSFW status.
		 * Mostly used for Discord channels.
		 * @type {number|null}
		 */
		this.NSFW = data.NSFW;

		/**
		 * If not null, every message sent to this channel will also be mirrored to the channel with this ID.
		 * Only 1-to-1 or one-way mirroring is supported.
		 * @type {sb.Channel.ID|null}
		 */
		this.Mirror = data.Mirror;

		/**
		 * A human-readable description of the channel.
		 * @type {string|null}
		 */
		this.Description = data.Description ?? null;

		if (data.Data) {
			try {
				data.Data = JSON.parse(data.Data);
				if (data.Data && data.Data.constructor !== Object) {
					console.warn(`Channel ${this.Name} (ID ${this.ID}) does not result in an Object`);
					data.Data = {};
				}
			}
			catch (e) {
				console.warn(`Channel ${this.Name} (ID ${this.ID}) has incorrect data definition`, e);
				data.Data = {};
			}
		}

		/**
		 * Optional channel data.
		 * @type {Object}
		 */
		this._Data = data.Data ?? {};
		this.Data = new Proxy(this._Data, {
			set: function (target, p, value) {
				console.warn("Deprecated Channel.Data set");
				target[p] = value;

				return true;
			},
			get: function (target, p) {
				console.warn("Deprecated Channel.Data get");
				return target[p];
			}
		});

		/**
		 * Session-specific data for a channel. Dyanamically updated at runtime.
		 * Is always reset on bot reset or channel reset.
		 * @type {Object}
		 */
		this.sessionData = {};

		/**
		 * Experimental support for external channel events.
		 */
		const EventEmitter = require("events");
		this.events = new EventEmitter();
	}

	/**
	 * Sets up the logging table and triggers for a newly created channel.
	 * @returns {boolean} True if new tables and triggeres were created, false if channel already has them set up
	 */
	async setup () {
		if (!this.Platform.Logging || !this.Platform.Logging.messages) {
			return false;
		}

		const databasePresent = await sb.Query.isDatabasePresent("chat_line");
		if (!databasePresent) {
			return false;
		}

		const limit = this.Message_Limit ?? this.Platform.Message_Limit;
		const prefix = (this.Platform.Name === "twitch")
			? ""
			: `${this.Platform.getFullName("_")}_`;

		const name = prefix + this.Name.toLowerCase();
		const alreadySetup = await sb.Query.isTablePresent("chat_line", name);
		if (alreadySetup) {
			return false;
		}

		const userAliasDefinition = await sb.Query.getDefinition("chat_data", "User_Alias");
		const idCol = userAliasDefinition.columns.find(i => i.name === "ID");
		const sign = (idCol.unsigned) ? "UNSIGNED" : "";

		// Set up logging table
		await sb.Query.raw([
			`CREATE TABLE IF NOT EXISTS chat_line.\`${name}\` (`,
			"`ID` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,",
			`\`User_Alias\` INT(${idCol.length}) ${sign} NOT NULL,`,
			`\`Text\` VARCHAR(${limit}),`,
			"`Posted` DATETIME(3) NULL DEFAULT NULL,",
			"PRIMARY KEY (`ID`),",
			`INDEX \`fk_user_alias_${name}\` (\`User_Alias\`),`,
			`CONSTRAINT \`fk_user_alias_${name}\` FOREIGN KEY (\`User_Alias\`) REFERENCES \`chat_data\`.\`User_Alias\` (\`ID\`) ON UPDATE CASCADE ON DELETE CASCADE)`,
			"COLLATE=`utf8mb4_general_ci` ENGINE=InnoDB AUTO_INCREMENT=1 PAGE_COMPRESSED=1;"
		].join(" "));

		// Set up user-specific meta logging trigger
		await sb.Query.raw([
			`CREATE TRIGGER IF NOT EXISTS chat_line.\`${name}_after_insert\``,
			`AFTER INSERT ON chat_line.\`${name}\` FOR EACH ROW`,
			"INSERT INTO chat_data.Message_Meta_User_Alias (User_Alias, Channel, Last_Message_Text, Last_Message_Posted)",
			`VALUES (NEW.User_Alias, ${this.ID}, NEW.Text, NEW.Posted)`,
			"ON DUPLICATE KEY UPDATE",
			"Message_Count = Message_Count + 1,",
			"Last_Message_Text = NEW.Text,",
			"Last_Message_Posted = NEW.Posted;"
		].join(" "));

		return true;
	}

	/**
	 * Waits until the user sends a message. Resolves with their response, or rejects if timed out.
	 * @param {number} userID
	 * @param {Object} options
	 * @returns {sb.Promise<UserMessageResolution>}
	 */
	waitForUserMessage (userID, options) {
		return this.Platform.waitForUserMessage(this, userID, options);
	}

	/**
	 * Returns the database name for the logging table of a given channel.
	 * Non-Twitch channels have their platform as lowercase prefix.
	 * @example cytube_somechannel (Cytube)
	 * @example discord_12345 (Discord)
	 * @example some_channel (Twitch)
	 * @returns {string}
	 */
	getDatabaseName () {
		return (this.Platform.Name === "twitch")
			? this.Name
			: `${this.Platform.getFullName("_").toLowerCase()}_${this.Name}`;
	}

	/**
	 * Returns the full name of a channel, including its platform name.
	 * For Discord, uses the guild rather than the actual channel name.
	 * @returns {string}
	 */
	getFullName () {
		if (this.Platform.Name === "discord") {
			if (this.Description) {
				const [guild] = this.Description.split("-");
				return `${this.Platform.Name}-${guild.trim()}`;
			}
			else {
				return this.Platform.Name;
			}
		}
		else {
			return `${this.Platform.Name}-${this.Name}`;
		}
	}

	/**
	 * Determines if a user is the owner of the channel the instances represents.
	 * @param {User} userData
	 * @returns {Promise<null|boolean>}
	 */
	isUserChannelOwner (userData) {
		return this.Platform.isUserChannelOwner(this, userData);
	}

	/**
	 * Checks if a provided user is an ambassador of the channel instance
	 * @param {User} userData
	 * @returns {boolean}
	 */
	async isUserAmbassador (userData) {
		const ambassadors = await this.getDataProperty("ambassadors") ?? [];
		return ambassadors.includes(userData.ID);
	}

	/**
	 * Sends a message into the current channel.
	 * @param message
	 * @returns {Promise<void>}
	 */
	send (message) {
		return this.Platform.send(message, this);
	}

	/**
	 * Returns the channel's stream-related data.
	 * @returns {Promise<Object>}
	 */
	async getStreamData () {
		const streamData = await this.getCacheData("stream-data");
		return streamData ?? {};
	}

	/**
	 * Sets the channel's stream-related data.
	 * @param {object} data
	 * @returns {Promise<any>}
	 */
	async setStreamData (data) {
		return await this.setCacheData("stream-data", data, { expiry: 3_600_000 });
	}

	/**
	 * Toggles a provided user's ambassador status in the current channel instance.
	 * @param {User} userData
	 * @returns {Promise<void>}
	 */
	async toggleAmbassador (userData) {
		const ambassadors = await this.getDataProperty("ambassadors", { forceCacheReload: true }) ?? [];
		if (ambassadors.includes(userData.ID)) {
			const index = ambassadors.indexOf(userData.ID);
			ambassadors.splice(index, 1);
		}
		else {
			ambassadors.push(userData.ID);
		}

		await this.setDataProperty("ambassadors", ambassadors);
	}

	/**
	 * Pushes a property change to the dataabse.
	 * @param {string} property
	 * @param {*} [value]
	 * @returns {Promise<void>}
	 */
	async saveProperty (property, value) {
		const row = await sb.Query.getRow("chat_data", "Channel");
		await row.load(this.ID);

		await super.saveRowProperty(row, property, value, this);
	}

	/**
	 * Mirrors the message to the given mirror channel, if this instance has been configured to do so.
	 * @param {string} message
	 * @param {User} userData
	 * @param {Object} [options]
	 * @param {boolean} [options.commandUsed] = false
	 * @returns {Promise<void>}
	 */
	async mirror (message, userData, options = {}) {
		if (this.Mirror === null) {
			return;
		}

		const targetChannel = Channel.get(this.Mirror);
		if (!targetChannel) {
			throw new sb.Error({
				message: "Invalid channel mirror configuration",
				args: { sourceChannel: this }
			});
		}

		return await this.Platform.controller.mirror(message, userData, this, options);
	}

	async serialize () {
		throw new sb.Error({
			message: "Module Channel cannot be serialized"
		});
	}

	/**
	 * Returns the current user list of the channel instance.
	 * @returns {Promise<string[]>}
	 */
	async fetchUserList () {
		return await this.Platform.fetchChannelUserList(this);
	}

	async fetchEmotes () {
		let channelEmotes = await this.getCacheData("emotes");
		if (!channelEmotes) {
			channelEmotes = await this.Platform.fetchChannelEmotes(this);
		}

		await this.setCacheData("emotes", channelEmotes, {
			expiry: 3_600_000 // 1 hour channel emotes cache
		});

		const globalEmotes = await this.Platform.fetchGlobalEmotes();
		return [...globalEmotes, ...channelEmotes];
	}

	async invalidateEmotesCache () {
		return await this.setCacheData("emotes", null);
	}

	/**
	 * Fetches the best fitting emote for the current channel instance.
	 * @param {string[]} emotes
	 * @param {string} fallbackEmote
	 * @param {Object} options = {}
	 * @param {boolean} [options.returnEmoteObject]
	 * @param {function} [options.filter]
	 * @returns {Promise<void>}
	 */
	async getBestAvailableEmote (emotes, fallbackEmote, options = {}) {
		const availableEmotes = await this.fetchEmotes();
		for (const emote of emotes) {
			const available = availableEmotes.find(i => i.name === emote);
			if (available && (typeof options.filter !== "function" || options.filter(available))) {
				return (options.returnEmoteObject)
					? available
					: available.name;
			}
		}

		return fallbackEmote;
	}

	async prepareMessage (message, options = {}) {
		return await this.Platform.prepareMessage(message, this, options);
	}

	async getDataProperty (propertyName, options = {}) {
		return await super.getGenericDataProperty({
			cacheMap: Channel.dataCache,
			databaseProperty: "Channel",
			databaseTable: "Channel_Data",
			instance: this,
			options,
			propertyName
		});
	}

	/**
	 * Saves a user data property into the database.
	 * @param {string} propertyName
	 * @param {*} value
	 * @param {Object} options
	 * @returns {Promise<void>}
	 */
	async setDataProperty (propertyName, value, options = {}) {
		return await super.setGenericDataProperty({
			cacheMap: Channel.dataCache,
			databaseProperty: "Channel",
			databaseTable: "Channel_Data",
			instance: this,
			propertyName,
			options,
			value
		});
	}

	getCacheKey () {
		return `sb-channel-${this.ID}`;
	}

	destroy () {
		if (sb.ChatModule) {
			sb.ChatModule.detachChannelModules(this.ID);
		}

		this.Data = null;
		this.sessionData = null;
	}

	static async loadData () {
		/** @type Channel[] */
		const data = await sb.Query.getRecordset(rs => rs
			.select("*")
			.from("chat_data", "Channel")
		);

		const previous = Channel.data;
		Channel.data = data.map(record => new Channel(record));
		if (Array.isArray(previous)) {
			for (const channel of previous) {
				channel.destroy();
			}
		}

		if (Channel.data.length === 0) {
			console.warn("No channels initialized - bot will not attempt to join any channels");
		}

		// Whenever channels are reloaded, chat modules also need to be reloaded and reattached.
		if (sb.ChatModule) {
			await sb.ChatModule.reloadData();
		}
	}

	static async reloadData () {
		await Channel.loadData();
	}

	/**
	 * Returns a Channel object, based on the identifier provided, and a optional platform parameter
	 * @param {ChannelLike} identifier
	 * @param {PlatformLike} [platform]
	 * @returns {sb.Channel|null}
	 * @throws {sb.Error} If identifier type is not recognized
	 */
	static get (identifier, platform) {
		if (platform) {
			platform = sb.Platform.get(platform);
		}

		if (identifier instanceof Channel) {
			return identifier;
		}
		else if (typeof identifier === "string") {
			const channelName = Channel.normalizeName(identifier);

			let result = Channel.data.filter(i => i.Name === channelName || i.Specific_ID === identifier);
			if (platform) {
				result = result.find(i => i.Platform === platform);
			}
			else {
				result = result[0];
			}

			return result ?? null;
		}
		else if (typeof identifier === "number") {
			return Channel.data.find(i => i.ID === identifier);
		}
		else {
			throw new sb.Error({
				message: "Invalid channel identifier type",
				args: { id: identifier, type: typeof identifier }
			});
		}
	}

	/**
	 * Fetches a list of joinable channels for a given platform.
	 * @param {PlatformLike} platform
	 * @returns {sb.Channel[]}
	 */
	static getJoinableForPlatform (platform) {
		const platformData = sb.Platform.get(platform);
		return Channel.data.filter(channel => (
			channel.Platform.ID === platformData.ID && channel.Mode !== "Inactive"
		));
	}

	/**
	 * Creates a new channel and pushes its definition to the database
	 * @param {string} name
	 * @param {sb.Platform} platformData
	 * @param {string} mode
	 * @param {string} [specificID]
	 * @returns {Promise<sb.Channel>}
	 */
	static async add (name, platformData, mode = "Write", specificID) {
		const channelName = Channel.normalizeName(name);

		// Creates Channel row
		const row = await sb.Query.getRow("chat_data", "Channel");
		row.setValues({
			Name: channelName,
			Platform: platformData.ID,
			Mode: mode,
			Specific_ID: specificID ?? null
		});
		await row.save();

		const channelData = new Channel({ ...row.valuesObject });
		await channelData.setup();

		Channel.data.push(channelData);
		if (sb.ChatModule) {
			sb.ChatModule.attachChannelModules(channelData);
		}

		return channelData;
	}

	/**
	 * @param {ChannelLike[]} list
	 * @returns {Promise<boolean>}
	 */
	static async reloadSpecific (...list) {
		const channelsData = list.map(i => Channel.get(i)).filter(Boolean);
		if (channelsData.length === 0) {
			return false;
		}

		const data = await sb.Query.getRecordset(rs => rs
			.select("*")
			.from("chat_data", "Channel")
			.where("ID IN %n+", channelsData.map(i => i.ID))
		);

		for (const channelData of channelsData) {
			const index = Channel.data.indexOf(channelData);
			if (index === -1) {
				throw new sb.Error({
					message: "Unexpected channel ID mismatch during reload"
				});
			}

			channelData.destroy();
			Channel.data.splice(index, 1);
		}

		for (const row of data) {
			const newChannelData = new Channel(row);
			if (sb.ChatModule) {
				sb.ChatModule.attachChannelModules(newChannelData);
			}

			Channel.data.push(newChannelData);
		}

		return true;
	}

	/**
	 * Normalizes non-standard strings into standardized database channel names..
	 * Turns input string into lowercase, removes leading `@`, leading `#`.
	 * @param {string} username
	 * @returns {string}
	 */
	static normalizeName (username) {
		return username
			.toLowerCase()
			.replace(/^@/, "");
	}
};

/**
 * @typedef {string|number|sb.Channel} ChannelLike
 */
