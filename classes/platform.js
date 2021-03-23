/**
 * Represents a user's AFK status
 * @memberof sb
 * @type Platform
 */
module.exports = class Platform extends require("./template.js") {
	/**
	 * Platform controller
	 * @type {Controller}
	 */
	#controller = null;
	#userMessagePromises = new Map();

	/**
	 * @param {Object} data
	 * @param {number} data.User_Alias
	 * @param {sb.Date} data.Started
	 * @param {string} data.Text
	 * @param {boolean} data.Silent
	 */
	constructor (data) {
		super();
		
		/**
		 * Unique numeric platform identifier.
		 * @type {User.ID}
		 */
		this.ID = data.ID;

		/**
		 * Unique platform name.
		 * @type {string}
		 */
		this.Name = data.Name.toLowerCase();

		/**
		 * Fallback message limit.
		 * @type {number}
		 */
		this.Message_Limit = data.Message_Limit;

		/**
		 * Name of the bot's account in given platform.
		 * @type {string}
		 */
		this.Self_Name = (data.Self_Name === null)
			? null
			: data.Self_Name.toLowerCase();

		/**
		 * Specific ID of the bot's account in given platform.
		 * Can be null if the platform does not support UIDs.
		 * @type {string|null}
		 */
		this.Self_ID = data.Self_ID;

		/**
		 * A string identifier to recognize a platform for mirroring.
		 * @type {string}
		 */
		this.Mirror_Identifier = data.Mirror_Identifier ?? null;

		/**
		 * Settings related to logging permissions and levels.
		 * @type {Object}
		 */
		this.Logging = {};

		if (data.Logging) {
			try {
				this.Logging = JSON.parse(data.Logging);
			}
			catch (e) {
				this.Logging = {};
				console.warn(`Platform ${this.Name} has incorrect logging settings definition`, e);
			}
		}

		/**
		 * Default platform-specific data.
		 * This can be customised in the Data column.
		 * The object is frozen, and thus cannot be modified.
		 * @type {Object}
		 */
		this.Defaults = Object.freeze({});

		if (data.Defaults) {
			try {
				this.Defaults = Object.freeze(JSON.parse(data.Defaults));
			}
			catch (e) {
				this.Defaults = Object.freeze({});
				console.warn(`Platform ${this.Name} has incorrect default settings definition`, e);
			}
		}

		/**
		 * Custom platform-specific data, parsed from JSON format.
		 * It is merged with defaults on startup.
		 * @type {Object}
		 */
		this.Data = {};

		if (data.Data) {
			try {
				// Merge together custom data with defaults - custom data has priority over defaults.
				this.Data = {
					...this.Defaults,
					...JSON.parse(data.Data)
				};
			}
			catch (e) {
				this.Data = { ...this.Defaults };
				console.warn(`Platform ${this.Name} has incorrect data definition`, e);
			}
		}
		else {
			this.Data = { ...this.Defaults };
		}
	}

	/**
	 * Determines if a user is an "owner" of a given channel in the platform.
	 * @param {Channel} channelData
	 * @param {User} userData
	 * @returns {null|boolean}
	 */
	isUserChannelOwner (channelData, userData) {
		if (typeof this.#controller.isUserChannelOwner !== "function") {
			return null;
		}

		return this.#controller.isUserChannelOwner(channelData, userData);
	}

	/**
	 * Sends a message into a given channel.
	 * @param message
	 * @param channel
	 * @returns {Promise<void>}
	 */
	send (message, channel) {
		return this.#controller.send(message, channel);
	}

	/**
	 * Sends a private message to a given user.
	 * @param {string} message
	 * @param {string} user
	 * @param {Channel} [channelData]
	 * @returns {Promise<void>}
	 */
	pm (message, user, channelData) {
		return this.#controller.pm(message, user, channelData);
	}

	destroy () {
		this.#controller = null;
	}

	waitForUserMessage (channelData, userData, options = {}) {
		const delay = options.timeout ?? 10_000;
		const promise = new sb.Promise();

		if (!this.#userMessagePromises.has(channelData)) {
			this.#userMessagePromises.set(channelData, new Map());
		}

		if (this.#userMessagePromises.get(channelData).get(userData)) {
			throw new sb.Error({
				message: "User already has a pending promise in the provided channel!"
			});
		}

		const timeout = setTimeout(() => {
			promise.resolve(null);
			this.#userMessagePromises.get(channelData).delete(userData);
		}, delay);

		this.#userMessagePromises.get(channelData).set(userData, { promise, timeout });

		return promise;
	}
	
	async serialize () {
		throw new sb.Error({
			message: "Module Platform cannot be serialized"
		});
	}

	async fetchChannelUserList (channelIdentifier) {
		const cacheData = await this.getCacheData({ channel: channelIdentifier });
		if (cacheData) {
			return cacheData;
		}

		const userList = await this.controller.fetchUserList(channelIdentifier);
		await this.setCacheData(
			{ channel: channelIdentifier },
			userList,
			{ expiry: 5 * 60e3 } // 5min
		);

		return userList;
	}

	async fetchGlobalEmotes () {
		const cacheData = await this.getCacheData("global-emotes");
		if (cacheData) {
			return cacheData;
		}

		const data = await this.controller.fetchGlobalEmotes();
		await this.setCacheData("global-emotes", data, {
			expiry: 864e5
		});

		return data;
	}

	async fetchChannelEmotes (channelData) {
		return await this.controller.fetchChannelEmotes(channelData);
	}

	async getBestAvailableEmote (channelData, emotes, fallbackEmote, options = {}) {
		if (channelData) {
			return channelData.getBestAvailableEmote(emotes, fallbackEmote, options);
		}

		const availableEmotes = await this.fetchGlobalEmotes();
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

	async prepareMessage (message, channel, options = {}) {
		return await this.controller.prepareMessage(message, channel, {
			...options,
			platform: options.platform ?? this // deprecated - should be removed
		});
	}

	getCacheKey () {
		return `sb-platform-${this.Name}`;
	}

	get userMessagePromises () {
		return this.#userMessagePromises;
	}

	get capital () {
		return sb.Utils.capitalize(this.Name);
	}

	/**
	 * Platform controller
	 * @type {Controller}
	 */
	get controller () {
		return this.#controller;
	}

	get client () {
		return this.#controller?.client ?? null;
	}
	
	static async loadData () {
		const data = await sb.Query.getRecordset(rs => rs
			.select("*")
			.from("chat_data", "Platform")
		);

		Platform.data = data.map(record => new Platform(record));

		if (Platform.data.length === 0) {
			console.warn("No platforms initialized - bot will not attempt to log in to any services");
		}
	}

	/**
	 * Assigns controllers to each platform after they have been prepared.
	 * @param {Object<string, Controller>}controllers
	 */
	static assignControllers (controllers) {
		for (const [name, controller] of Object.entries(controllers)) {
			const platform = Platform.get(name);
			if (platform) {
				platform.#controller = controller;
			}
		}
	}

	static get (identifier) {
		if (identifier instanceof Platform) {
			return identifier;
		}
		else if (typeof identifier === "number") {
			return Platform.data.find(i => i.ID === identifier);
		}
		else if (typeof identifier === "string") {
			return Platform.data.find(i => i.Name === identifier);
		}
		else {
			throw new sb.Error({
				message: "Unrecognized platform identifier type",
				args: typeof identifier
			});
		}
	}

	/**
	 * Cleans up.
	 */
	static destroy () {
		for (const platform of Platform.data) {
			platform.destroy();
		}

		super.destroy();
	}
};