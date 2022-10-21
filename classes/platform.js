module.exports = class Platform extends require("./template.js") {
	#controller = null;
	#userMessagePromises = new Map();

	constructor (data) {
		super();
		this.ID = data.ID;
		this.Name = data.Name.toLowerCase();
		this.Host = data.Host ?? null;
		this.Message_Limit = data.Message_Limit;
		this.Self_Name = (data.Self_Name === null)
			? null
			: data.Self_Name.toLowerCase();
		this.Self_ID = data.Self_ID;
		this.Mirror_Identifier = data.Mirror_Identifier ?? null;
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

	isUserChannelOwner (channelData, userData) {
		if (typeof this.#controller.isUserChannelOwner !== "function") {
			return null;
		}

		return this.#controller.isUserChannelOwner(channelData, userData);
	}

	send (message, channel, options = {}) {
		return this.#controller.send(message, channel, options);
	}

	pm (message, user, channelData) {
		return this.#controller.pm(message, user, channelData);
	}

	destroy () {
		this.#controller = null;
	}

	waitForUserMessage (channelData, userData, options = {}) {
		const delay = options.timeout ?? 10_000;
		const promise = new sb.Promise();

		if (!this.#userMessagePromises.has(channelData.ID)) {
			this.#userMessagePromises.set(channelData.ID, new Map());
		}

		if (this.#userMessagePromises.get(channelData.ID).get(userData.ID)) {
			throw new sb.Error({
				message: "User already has a pending promise in the provided channel!"
			});
		}

		const timeout = setTimeout(() => {
			promise.resolve(null);
			this.#userMessagePromises.get(channelData.ID).delete(userData.ID);
		}, delay);

		this.#userMessagePromises.get(channelData.ID).set(userData.ID, { promise, timeout });

		return promise;
	}

	async serialize () {
		throw new sb.Error({
			message: "Module Platform cannot be serialized"
		});
	}

	async fetchChannelUserList (channelData) {
		const key = {
			type: "channel-user-list",
			ID: channelData.ID
		};

		const cacheData = await this.getCacheData(key);
		if (cacheData) {
			return cacheData;
		}

		const userList = await this.controller.fetchUserList(channelData.Name);
		await this.setCacheData(
			key,
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

	async invalidateGlobalEmotesCache () {
		return await this.setCacheData("global-emotes", null);
	}

	async fetchChannelEmotes (channelData) {
		return await this.controller.fetchChannelEmotes(channelData);
	}

	async getBestAvailableEmote (channelData, emotes, fallbackEmote, options = {}) {
		if (channelData) {
			return channelData.getBestAvailableEmote(emotes, fallbackEmote, options);
		}

		const availableEmotes = await this.fetchGlobalEmotes();
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

	async prepareMessage (message, channel, options = {}) {
		return await this.controller.prepareMessage(message, channel, {
			...options,
			platform: options.platform ?? this // deprecated - should be removed
		});
	}

	getFullName (separator = "-") {
		if (this.Name === "irc") {
			return [this.Name, this.Host].filter(Boolean).join(separator);
		}
		else {
			return this.Name;
		}
	}

	getCacheKey () {
		const name = this.getFullName("-");
		return `sb-platform-${name}`;
	}

	async createUserMention (userData) {
		return await this.#controller.createUserMention(userData);
	}

	get userMessagePromises () {
		return this.#userMessagePromises;
	}

	get capital () {
		return sb.Utils.capitalize(this.Name);
	}

	get privateMessageLoggingTableName () {
		const name = this.getFullName("_");
		return `#${name}_private_messages`;
	}

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

	static assignControllers (controllers) {
		for (const [name, controller] of Object.entries(controllers)) {
			const platform = Platform.get(name);
			if (platform) {
				platform.#controller = controller;
			}
		}
	}

	static get (identifier, host) {
		if (identifier instanceof Platform) {
			return identifier;
		}
		else if (typeof identifier === "number") {
			return Platform.data.find(i => i.ID === identifier) ?? null;
		}
		else if (typeof identifier === "string") {
			const eligible = Platform.data.filter(i => i.Name === identifier);
			if (eligible.length === 0) {
				return null;
			}
			else if (host === null || typeof host === "string") {
				return eligible.find(i => i.Host === host);
			}
			else {
				if (eligible.length > 1) {
					throw new sb.Error({
						message: "Ambiguous platform name - use host as second parameter",
						args: { identifier }
					});
				}

				return eligible[0];
			}
		}
		else {
			throw new sb.Error({
				message: "Unrecognized platform identifier type",
				args: typeof identifier
			});
		}
	}

	static destroy () {
		for (const platform of Platform.data) {
			platform.destroy();
		}

		super.destroy();
	}
};
