module.exports = class Channel extends require("./template.js") {
	static redisPrefix = "sb-channel";
	static dataCache = new WeakMap();
	#setupPromise = null;

	constructor (data) {
		super();

		this.ID = data.ID;
		this.Name = data.Name;
		this.Platform = sb.Platform.get(data.Platform);
		this.Specific_ID = data.Specific_ID || null;
		this.Mode = data.Mode;
		this.Mention = data.Mention;
		this.Links_Allowed = data.Links_Allowed;
		this.Banphrase_API_Type = data.Banphrase_API_Type;
		this.Banphrase_API_URL = data.Banphrase_API_URL;
		this.Banphrase_API_Downtime = data.Banphrase_API_Downtime;
		this.Message_Limit = data.Message_Limit;
		this.NSFW = data.NSFW;
		this.Logging = new Set(data.Logging ?? []);
		this.Mirror = data.Mirror;
		this.Description = data.Description ?? null;

		this.sessionData = {};

		const EventEmitter = require("events");
		this.events = new EventEmitter();
	}

	setup () {
		if (!this.Platform.Logging || !this.Platform.Logging.messages) {
			return Promise.resolve(false);
		}

		if (this.#setupPromise) {
			return this.#setupPromise;
		}

		this.#setupPromise = (async () => {
			const databasePresent = await sb.Query.isDatabasePresent("chat_line");
			if (!databasePresent) {
				return false;
			}

			const limit = this.Platform.Message_Limit;
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
		})();

		return this.#setupPromise;
	}

	waitForUserMessage (userID, options) {
		return this.Platform.waitForUserMessage(this, userID, options);
	}

	getDatabaseName () {
		return (this.Platform.Name === "twitch")
			? this.Name
			: `${this.Platform.getFullName("_").toLowerCase()}_${this.Name}`;
	}

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

	isUserChannelOwner (userData) {
		return this.Platform.isUserChannelOwner(this, userData);
	}

	async isUserAmbassador (userData) {
		const ambassadors = await this.getDataProperty("ambassadors") ?? [];
		return ambassadors.includes(userData.ID);
	}

	send (message, options = {}) {
		return this.Platform.send(message, this, options);
	}

	async getStreamData () {
		const streamData = await this.getCacheData("stream-data");
		return streamData ?? {};
	}

	async setStreamData (data) {
		return await this.setCacheData("stream-data", data, { expiry: 3_600_000 });
	}

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

	async saveProperty (property, value) {
		const row = await sb.Query.getRow("chat_data", "Channel");
		await row.load(this.ID);

		await super.saveRowProperty(row, property, value, this);
	}

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

	async getBestAvailableEmote (emotes, fallbackEmote, options = {}) {
		const availableEmotes = await this.fetchEmotes();
		const emoteArray = (options.shuffle)
			? sb.Utils.shuffleArray(emotes)
			: emotes;

		for (const emote of emoteArray) {
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

		this.sessionData = null;
	}

	static async loadData () {
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

	static getJoinableForPlatform (platform) {
		const platformData = sb.Platform.get(platform);
		return Channel.data.filter(channel => (
			channel.Platform.ID === platformData.ID && channel.Mode !== "Inactive"
		));
	}

	static async add (name, platformData, mode = "Write", specificID) {
		const channelName = Channel.normalizeName(name);
		const existing = Channel.get(channelName);
		if (existing) {
			return existing;
		}

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
		Channel.data.push(channelData);

		await channelData.setup();

		if (sb.ChatModule) {
			sb.ChatModule.attachChannelModules(channelData);
		}

		return channelData;
	}

	static async moveData (oldChannelData, newChannelData, options = {}) {
		const properties = await sb.Query.getRecordset(rs => rs
			.select("Property", "Value")
			.from("chat_data", "Channel_Data")
			.where("Channel = %n", oldChannelData.ID)
		);

		const skipProperties = options.skipProperties ?? [];
		const savePromises = [];
		for (const row of properties) {
			if (skipProperties.includes(row.Property)) {
				continue;
			}

			const propertyRow = await sb.Query.getRow("chat_data", "Channel_Data");
			await propertyRow.load({
				Channel: newChannelData.ID,
				Property: row.Property
			}, true);

			if (!propertyRow.loaded) {
				propertyRow.setValues({
					Channel: newChannelData.ID,
					Property: row.Property
				});
			}

			propertyRow.values.Value = row.Value;

			const promise = propertyRow.save({ skipLoad: true });
			savePromises.push(promise);
		}

		await Promise.all(savePromises);

		if (options.deleteOriginalValues) {
			await sb.Query.getRecordDeleter(rd => rd
				.delete()
				.from("chat_data", "Channel_Data")
				.where("Channel = %n", oldChannelData.ID)
			);
		}
	}

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

	static normalizeName (username) {
		return username
			.toLowerCase()
			.replace(/^@/, "");
	}
};
