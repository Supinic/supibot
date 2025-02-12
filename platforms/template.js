import createMessageLoggingTable from "../utils/create-db-table.js";
const DEFAULT_MESSAGE_WAIT_TIMEOUT = 10_000;

export default class Platform {
	#id;
	#name;
	#host;
	#messageLimit;
	#selfId;
	#selfName;
	#mirrorIdentifier;
	#data;
	#loggingConfig;
	#active;

	#globalEmoteCacheKey;

	client;
	supportsMeAction = false;
	dynamicChannelAddition = false;
	#userMessagePromises = new Map();

	#privateMessagesTablePromise = null;

	/** @type {Platform[]} */
	static list = [];

	constructor (name, config, defaults = {}) {
		this.#name = name;
		this.#id = config.ID;
		if (!this.#id) {
			throw new sb.Error({
				message: "Platform ID must be configured"
			});
		}
		else if (!Number.isInteger(this.#id)) {
			throw new sb.Error({
				message: "Platform ID must be an integer"
			});
		}

		this.#host = config.host ?? null;
		this.#messageLimit = config.messageLimit ?? null;
		this.#selfId = config.selfId ?? null;
		this.#selfName = config.selfName?.toLowerCase() ?? null;
		this.#mirrorIdentifier = config.mirrorIdentifier ?? null;

		this.#data = {
			...defaults.platform,
			...config.platform
		};
		this.#loggingConfig = {
			...defaults.logging,
			...config.logging
		};

		this.#globalEmoteCacheKey = `global-emotes-${this.#id}`;
		this.#active = config.active ?? false;

		Platform.list.push(this);
	}

	get ID () { return this.#id; }
	get Name () { return this.#name; }
	get name () { return this.#name; }
	get Host () { return this.#host; }
	get host () { return this.#host; }
	get Message_Limit () { return this.#messageLimit; }
	get messageLimit () { return this.#messageLimit; }
	get Self_Name () { return this.#selfName; }
	get selfName () { return this.#selfName; }
	get Self_ID () { return this.#selfId; }
	get selfId () { return this.#selfId; }
	get Mirror_Identifier () { return this.#mirrorIdentifier; }
	get mirrorIdentifier () { return this.#mirrorIdentifier; }
	get Data () { return this.#data; }
	get data () { return this.#data; }
	get config () { return this.#data; }
	get Logging () { return this.#loggingConfig; }
	get logging () { return this.#loggingConfig; }
	get active () { return this.#active; }

	get capital () { return sb.Utils.capitalize(this.#name); }
	get userMessagePromises () { return this.#userMessagePromises; }
	get privateMessageLoggingTableName () {
		const name = this.getFullName("_");
		return `#${name}_private_messages`;
	}

	checkConfig () {
		if (!this.#selfName) {
			throw new sb.Error({
				message: "Invalid Platform property: selfName",
				args: { id: this.#id, name: this.#name, selfName: this.#selfName }
			});
		}

		if (!Number.isInteger(this.#messageLimit) || this.#messageLimit <= 0) {
			throw new sb.Error({
				message: "Invalid Platform property: messageLimit",
				args: { id: this.#id, name: this.#name, messageLimit: this.#messageLimit }
			});
		}
	}

	getFullName (separator = "-") {
		if (this.#name === "irc") {
			return [this.#name, this.#host].filter(Boolean).join(separator);
		}
		else {
			return this.#name;
		}
	}

	initListeners () {}

	/**
	 * @abstract
	 */
	async send (message, channel, options = {}) {
		throw new sb.Error({
			message: "This method is not implemented by the derived Platform"
		});
	}

	/**
	 * @abstract
	 */
	async pm (message, user) {
		throw new sb.Error({
			message: "This method is not implemented by the derived Platform"
		});
	}

	/**
	 * @abstract
	 */
	me () {
		throw new sb.Error({
			message: "This method is not implemented by the derived Platform"
		});
	}

	/**
	 * @abstract
	 */
	isUserChannelOwner (channelData, userData) {
		throw new Error("Abstract method not implemented");
	}

	incrementMessageMetric (type, channelIdentifier) {
		if (!sb.Metrics) {
			return;
		}

		if (type !== "sent" && type !== "read") {
			throw new sb.Error({
				message: "Incorrect message metric type provided",
				args: { type, channelIdentifier }
			});
		}

		let channel = "(private)";
		if (channelIdentifier) {
			const channelData = sb.Channel.get(channelIdentifier);
			if (!channelData) {
				return;
			}

			channel = channelData.Name;
		}

		const metric = sb.Metrics.get(`supibot_messages_${type}_total`);
		if (!metric) {
			return;
		}

		metric.inc({
			channel,
			platform: this.name
		});
	}

	waitForUserMessage (channelData, userData, options = {}) {
		const delay = options.timeout ?? DEFAULT_MESSAGE_WAIT_TIMEOUT;
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

	/**
	 * Resolves a registered awaiting message.
	 * @param {Channel|null} channelData
	 * @param {User} userData
	 * @param {string} message
	 */
	resolveUserMessage (channelData, userData, message) {
		const channelIdentifier = channelData?.ID ?? null;
		const channelMap = this.#userMessagePromises.get(channelIdentifier);
		if (channelMap && channelMap.has(userData.ID)) {
			const { promise, timeout } = channelMap.get(userData.ID);
			clearTimeout(timeout);

			channelMap.delete(userData.ID);
			promise.resolve({ message });
		}
	}

	/**
	 * Mirrors a message from one channel to another
	 * Mirrored messages should not be prepared in the origin channel, they are checked against the target channel.
	 * Double checking would lead to inconsistent behaviour.
	 * @param {string} message
	 * @param {User|null} userData
	 * @param {Channel} channelData The channel where the message is coming from
	 * @param {Object} [options]
	 * @param {boolean} [options.commandUsed] = false If a command was used, do not include the user name of who issued the command.
	 * @returns {Promise<void>}
	 */
	async mirror (message, userData, channelData, options = {}) {
		const mirrorChannelData = sb.Channel.get(channelData.Mirror);
		if (!mirrorChannelData) {
			console.warn("Provided channel does not have any mirror channel set up", { channelData });
			return;
		}

		// Do not mirror if no identifier has been configured
		const symbol = this.mirrorIdentifier;
		if (symbol === null) {
			return;
		}

		// Do not mirror own messages
		if (userData && userData.Name === channelData.Platform.selfName) {
			return;
		}

		const fixedMessage = (!userData || options.commandUsed)
			? `${symbol} ${message}`
			: `${symbol} ${userData.Name}: ${message}`;

		const platform = mirrorChannelData.Platform;
		const finalMessage = await platform.prepareMessage(fixedMessage, mirrorChannelData, options);

		if (finalMessage) {
			try {
				await mirrorChannelData.send(finalMessage);
			}
			catch (e) {
				return {
					error: e,
					success: false
				};
			}
		}

		return {
			success: true
		};
	}

	/**
	 * @abstract
	 */
	async populateUserList () {
		throw new sb.Error({
			message: "This method is not implemented by the derived Platform"
		});
	}

	async fetchChannelUserList (channelData) {
		const key = this.#getChannelUserListKey(channelData);
		const cacheData = await sb.Cache.getByPrefix(key);
		if (cacheData) {
			return cacheData;
		}

		const userList = await this.populateUserList(channelData);

		await sb.Cache.setByPrefix(key, userList, {
			expiry: 300_000 // 5 minutes
		});

		return userList;
	}

	/**
	 * @abstract
	 */
	async populateGlobalEmotes (channelData) {
		throw new sb.Error({
			message: "This method is not implemented by the derived Platform"
		});
	}

	async fetchGlobalEmotes () {
		const key = this.#globalEmoteCacheKey;
		const cacheData = await sb.Cache.getByPrefix(key);
		if (cacheData) {
			return cacheData;
		}

		const data = await this.populateGlobalEmotes();
		await sb.Cache.setByPrefix(key, data, {
			expiry: 864e5 // 24 hours
		});

		return data;
	}

	async invalidateGlobalEmotesCache () {
		const key = this.#globalEmoteCacheKey;
		return await sb.Cache.setByPrefix(key, null);
	}

	/**
	 * @abstract
	 */
	async fetchChannelEmotes () {
		throw new sb.Error({
			message: "This method is not implemented by the derived Platform"
		});
	}

	async getBestAvailableEmote (channelData, emotes, fallbackEmote, options = {}) {
		if (channelData) {
			return channelData.getBestAvailableEmote(emotes, fallbackEmote, options);
		}

		const availableEmotes = await this.fetchGlobalEmotes();
		const emoteArray = (options.shuffle)
			? sb.Utils.shuffleArray(emotes)
			: emotes;

		const caseSensitive = options.caseSensitivity ?? true;
		for (const emote of emoteArray) {
			const lowerEmote = emote.toLowerCase();
			const available = availableEmotes.find(i => (caseSensitive)
				? (i.name === emote)
				: (i.name.toLowerCase() === lowerEmote)
			);

			if (available && (typeof options.filter !== "function" || options.filter(available))) {
				return (options.returnEmoteObject)
					? available
					: available.name;
			}
		}

		return fallbackEmote;
	}

	/**
	 * Prepares a message to be sent in the provided channel.
	 * Checks banphrases, respects length limits.
	 * Ignores if channel is inactive or read-only
	 * @param {string} message
	 * @param {Channel} channel
	 * @param {Object} options = {}
	 * @param {boolean} [options.skipBanphrases] If true, no banphrases will be checked
	 * @param {boolean} [options.skipLengthCheck] If true, length will not be checked
	 * @param {boolean} [options.keepWhitespace] If true, whitespace will not be stripped
	 * @returns {Promise<String|Boolean>} Returns prepared message, or false if nothing is to be sent (result is ignored)
	 */
	async prepareMessage (message, channel, options = {}) {
		let channelData = null;
		let limit = Infinity;

		if (channel !== null) {
			channelData = sb.Channel.get(channel);

			// Read-only/Inactive/Nonexistent - do not send anything
			if (!channelData || channelData.Mode === "Read" || channelData.Mode === "Inactive") {
				return false;
			}

			// Remove all links, if the channel requires it - replace all links with a placeholder
			if (channelData.Links_Allowed === false) {
				message = sb.Utils.replaceLinks(message, "[LINK]");
			}

			if (!options.skipLengthCheck) {
				limit = channelData.Message_Limit ?? channelData.Platform.messageLimit;
			}
		}

		message = sb.Utils.wrapString(message, limit, {
			keepWhitespace: Boolean(options.keepWhitespace)
		});

		// Execute all eligible banphrases, if necessary
		if (!options.skipBanphrases && sb.Banphrase) {
			const { passed, string } = await sb.Banphrase.execute(message, channelData);
			if (!passed && options.returnBooleanOnFail) {
				return passed;
			}

			message = string;
		}

		// If the result is not string, do not reply at all.
		if (typeof message !== "string") {
			return false;
		}

		return message;
	}

	async createUserMention (userData) {
		return userData.Name;
	}

	/**
	 * @abstract
	 */
	fetchInternalPlatformIDByUsername (userData) {
		throw new sb.Error({
			message: "This method is not implemented by the derived Platform"
		});
	}

	/**
	 * @abstract
	 */
	async fetchUsernameByUserPlatformID (userPlatformID) {
		throw new sb.Error({
			message: "This method is not implemented by the derived Platform"
		});
	}

	#getChannelUserListKey (channelData) {
		return `channel-user-list-${this.#id}-${channelData.ID}`;
	}

	async isChannelLive (channelData) {
		if (channelData.Platform !== this) {
			throw new sb.Error({
				message: "Provided channel does not belong to this platform",
				args: {
					channel: channelData.ID,
					channelPlatform: channelData.Platform?.ID ?? null,
					currentPlatform: this.ID
				}
			});
		}

		// If not overloaded, return `null` - this means the platform does not support the concept of "livestreaming".
		return null;
	}

	setupLoggingTable () {
		if (this.#privateMessagesTablePromise) {
			return this.#privateMessagesTablePromise;
		}

		const name = this.privateMessageLoggingTableName;
		this.#privateMessagesTablePromise = createMessageLoggingTable(name);
		return this.#privateMessagesTablePromise;
	}

	restart () {}

	destroy () {}

	static get (identifier, host) {
		if (identifier instanceof Platform) {
			return identifier;
		}
		else if (typeof identifier === "number") {
			return Platform.list.find(i => i.ID === identifier) ?? null;
		}
		else if (typeof identifier === "string") {
			const eligible = Platform.list.filter(i => i.name === identifier);
			if (eligible.length === 0) {
				return null;
			}
			else if (host === null || typeof host === "string") {
				return eligible.find(i => i.host === host);
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

	static async create (type, config) {
		let InstancePlatform;
		try {
			// @todo refactor this to direct imports + platform map. return generic for platforms not in the map
			const dynamicInstanceImport = await import(`./${type}.js`);
			InstancePlatform = dynamicInstanceImport.default;
		}
		catch {
			console.log(`No file found for platform "${type}", creating generic platform`);
			return new Platform(type, config);
		}

		let instance;
		try {
			instance = new InstancePlatform(config);
		}
		catch (e) {
			console.error(`An error occured while instantiating platform "${type}", skipping:\n`, e);
		}

		return instance;
	}
}

/**
 * @typedef {Object} TypedEmote Describes any emote
 * @property {string} ID
 * @property {string} name
 * @property {string} type
 * @property {boolean} global
 * @property {boolean} animated
 * @property {boolean} zeroWidth
 */
