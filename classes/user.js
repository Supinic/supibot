module.exports = class User extends require("./template.js") {
	static mapCacheExpiration = 300_000;
	static redisCacheExpiration = 3_600_000;
	static mapExpirationInterval = setInterval(() => User.data.clear(), User.mapCacheExpiration);

	static data = new Map();
	static bots = new Map();
	static dataCache = new WeakMap();
	static pendingNewUsers = new Map();
	static uniqueIdentifier = "ID";

	static permissions = {
		regular: 0b0000_0001,
		ambassador: 0b0000_0010,
		channelOwner: 0b0000_0100,
		administrator: 0b1000_0000
	};

	static loadUserPrefix = "sb-user-high-load";
	static loadUserPrefixExpiry = 60_000;
	static highLoadThreshold = 50;
	static criticalLoadThreshold = 200;

	static highLoadUserBatch;

	static highLoadUserInterval = setInterval(async () => {
		User.highLoadUserBatch ??= await sb.Query.getBatch(
			"chat_data",
			"User_Alias",
			["Name", "Twitch_ID", "Discord_ID"]
		);

		if (!User.highLoadUserBatch.ready) {
			return;
		}

		const users = User.highLoadUserBatch.records.map(i => i.Name);
		await User.highLoadUserBatch.insert();

		for (const user of users) {
			User.pendingNewUsers.delete(user);
		}
	}, User.loadUserPrefixExpiry);

	constructor (data) {
		super();

		/**
		 * Unique numeric ID.
		 * @type {number}.
		 */
		this.ID = data.ID;

		/**
		 * Unique Discord identifier.
		 * Only verified users (non-null Discord ID value) can use the bot on Discord.
		 * @type {number}
		 */
		this.Discord_ID = data.Discord_ID;

		/**
		 * Unique Twitch identifier.
		 * @type {number}
		 */
		this.Twitch_ID = data.Twitch_ID;

		/**
		 * Unique name.
		 * @type {string}
		 */
		this.Name = data.Name;

		/**
		 * Date of first sighting.
		 * @type {sb.Date}
		 */
		this.Started_Using = (data.Started_Using instanceof sb.Date)
			? data.Started_Using
			: new sb.Date(data.Started_Using);

		/**
		 * Extra data given to each user.
		 * @type {Object}
		 */
		if (!data.Data) {
			this.Data = {};
		}
		else if (typeof data.Data === "string") {
			try {
				this.Data = JSON.parse(data.Data);
			}
			catch (e) {
				console.warn("User.Data parse error", { error: e, user: this, data });
				this.Data = {};
			}
		}
		else if (typeof data.Data === "object") {
			this.Data = { ...data.Data };
		}
		else {
			console.warn("User.Data invalid type", { user: this, data });
			this.Data = {};
		}
	}

	getCacheKey () {
		return `sb-user-${this.Name}`;
	}

	async saveProperty (property, value) {
		const row = await sb.Query.getRow("chat_data", "User_Alias");
		await row.load(this.ID);

		await super.saveRowProperty(row, property, value, this);

		await User.invalidateUserCache(this);
		await User.populateCaches(this);
	}

	async getDataProperty (propertyName, options = {}) {
		return await super.getGenericDataProperty({
			cacheMap: User.dataCache,
			databaseProperty: "User_Alias",
			databaseTable: "User_Alias_Data",
			instance: this,
			propertyContext: "User",
			options,
			propertyName
		});
	}

	async setDataProperty (propertyName, value, options = {}) {
		return await super.setGenericDataProperty({
			cacheMap: User.dataCache,
			databaseProperty: "User_Alias",
			databaseTable: "User_Alias_Data",
			instance: this,
			propertyContext: "User",
			propertyName,
			options,
			value
		});
	}

	async serialize () {
		throw new sb.Error({
			message: "Module User cannot be serialized"
		});
	}

	static async initialize () {
		User.bots = new Map();
		User.data = new Map();

		await User.loadData();
		return User;
	}

	static async loadData () {
		/** @type {Map<string, User>} */
		User.data = User.data || new Map();

		const botDataExist = await sb.Query.isTablePresent("bot_data", "Bot");
		if (botDataExist) {
			const botData = await sb.Query.getRecordset(rs => rs
				.select("Prefix", "Last_Verified", "Author", "Language")
				.select("User_Alias.ID AS ID", "User_Alias.Name AS Name")
				.from("bot_data", "Bot")
				.join({
					toDatabase: "chat_data",
					toTable: "User_Alias",
					on: "Bot.Bot_Alias = User_Alias.ID"
				})
			);

			for (const bot of botData) {
				User.bots.set(bot.ID, bot);
			}
		}
	}

	static async reloadData () {
		User.bots.clear();
		User.data.clear();
		await User.loadData();
	}

	static async get (identifier, strict = true, options = {}) {
		if (identifier instanceof User) {
			return identifier;
		}
		else if (typeof identifier === "number") {
			const mapCacheUser = User.getByProperty("ID", identifier);
			if (mapCacheUser) {
				return mapCacheUser;
			}

			const name = await sb.Query.getRecordset(rs => rs
				.select("Name")
				.from("chat_data", "User_Alias")
				.where("ID = %n", identifier)
				.single()
				.flat("Name")
			);
			if (!name) {
				return null;
			}

			return User.get(name, strict, options);
		}
		else if (typeof identifier === "string") {
			const username = User.normalizeUsername(identifier);

			// 1. attempt to fetch the user from low-cache (User.data)
			const mapCacheUser = User.data.get(username);
			if (mapCacheUser) {
				return mapCacheUser;
			}

			// 2. attempt to fetch the user from medium-cache (sb.Cache)
			if (sb.Cache && sb.Cache.active) {
				const redisCacheUser = await User.createFromCache({ name: username });
				if (redisCacheUser) {
					if (!User.data.has(username)) {
						User.data.set(username, redisCacheUser);
					}

					return redisCacheUser;
				}
			}

			// 3. attempt to get the user out of the database
			const dbUserData = await sb.Query.getRecordset(rs => rs
				.select("*")
				.from("chat_data", "User_Alias")
				.where("Name = %s", username)
				.single()
			);

			let userData;
			if (dbUserData) {
				userData = new User(dbUserData);
			}
			// 4. If strict mode is off, create the user and return the instance immediately
			else if (!strict) {
				userData = await User.add(username, {
					Discord_ID: options.Discord_ID ?? null,
					Twitch_ID: options.Twitch_ID ?? null
				});
			}
			// 5. If strict mode is on and the user does not exist, return null and exit
			else {
				return null;
			}

			await User.populateCaches(userData);
			return userData;
		}
		else {
			throw new sb.Error({
				message: "Invalid user identifier type",
				args: { id: identifier, type: typeof identifier }
			});
		}
	}

	static async getMultiple (identifiers) {
		const result = [];
		const toFetch = [];
		let userMapValues;

		for (const identifier of identifiers) {
			if (identifier instanceof User) {
				result.push(identifier);
			}
			else if (typeof identifier === "number") {
				if (!userMapValues) {
					userMapValues = [...User.data.values()];
				}

				const mapCacheUser = userMapValues.find(i => i.ID === identifier);
				if (mapCacheUser) {
					result.push(mapCacheUser);
				}
				else {
					toFetch.push(identifier);
				}
			}
			else if (typeof identifier === "string") {
				const username = User.normalizeUsername(identifier);
				const mapCacheUser = User.data.get(username);
				if (mapCacheUser) {
					result.push(mapCacheUser);
					continue;
				}

				if (sb.Cache && sb.Cache.active) {
					const redisCacheUser = await User.createFromCache({ name: username });
					if (redisCacheUser) {
						User.data.set(username, redisCacheUser);
						result.push(redisCacheUser);
						continue;
					}
				}

				toFetch.push(username);
			}
			else {
				throw new sb.Error({
					message: "Invalid user identifier type",
					args: { id: identifier, type: typeof identifier }
				});
			}
		}

		if (toFetch.length > 0) {
			const [strings, numbers] = sb.Utils.splitByCondition(toFetch, i => typeof i === "string");
			const fetched = await sb.Query.getRecordset(rs => {
				rs.select("*").from("chat_data", "User_Alias");
				if (strings.length > 0 && numbers.length > 0) {
					rs.where("Name IN %s+ OR ID IN %n+", strings, numbers);
				}
				else if (strings.length > 0) {
					rs.where("Name IN %s+", strings);
				}
				else if (numbers.length > 0) {
					rs.where("ID IN %n+", numbers);
				}
			});

			const cachePromises = [];
			for (const rawUserData of fetched) {
				const userData = new User(rawUserData);
				result.push(userData);
				cachePromises.push(User.populateCaches(userData));
			}

			await Promise.all(cachePromises);
		}

		return result;
	}

	static getByProperty (property, identifier) {
		const iterator = User.data.values();
		let user = undefined;
		let value = iterator.next().value;

		while (!user && value) {
			if (value[property] === identifier) {
				user = value;
			}
			value = iterator.next().value;
		}

		return user;
	}

	static normalizeUsername (username) {
		return username
			.toLowerCase()
			.replace(/^@/, "")
			.replace(/^#/, "")
			.replace(/:$/g, "")
			.replace(/\s+/g, "_");
	}

	static async add (name, properties = {}) {
		await sb.Cache.setByPrefix(`${User.loadUserPrefix}-${name}`, "1", {
			expiry: User.loadUserPrefixExpiry
		});

		const preparedName = User.normalizeUsername(name);
		if (User.pendingNewUsers.has(preparedName)) {
			return User.pendingNewUsers.get(preparedName);
		}

		const keys = await sb.Cache.getKeysByPrefix(User.loadUserPrefixExpiry);
		if (keys.length > User.criticalLoadThreshold) {
			return null;
		}
		else if (keys.length > User.highLoadThreshold) {
			User.pendingNewUsers.set(preparedName, null);
			User.highLoadUserBatch.add({
				Name: preparedName,
				...properties
			});

			return null;
		}
		else {
			const promise = (async () => {
				const exists = await sb.Query.getRecordset(rs => rs
					.select("Name")
					.from("chat_data", "User_Alias")
					.where("Name = %s", preparedName)
					.limit(1)
					.single()
				);

				if (exists) {
					User.pendingNewUsers.delete(preparedName);
					return await User.get(exists.Name);
				}

				return await User.#add(preparedName, properties);
			})();

			User.pendingNewUsers.set(preparedName, promise);
			return await promise;
		}
	}

	static async #add (name, properties) {
		const row = await sb.Query.getRow("chat_data", "User_Alias");
		row.values.Name = name;

		if (properties.Twitch_ID) {
			row.values.Twitch_ID = properties.Twitch_ID;
		}
		if (properties.Discord_ID) {
			row.values.Discord_ID = properties.Discord_ID;
		}

		await row.save();

		const user = new User(row.valuesObject);
		await User.populateCaches(user);

		if (User.pendingNewUsers.has(name)) {
			User.pendingNewUsers.delete(name);
		}

		return user;
	}

	static async populateCaches (user) {
		if (!User.data.has(user.Name)) {
			User.data.set(user.Name, user);
		}

		if (sb.Cache && sb.Cache.active) {
			await sb.Cache.setByPrefix(user.getCacheKey(), user, {
				expiry: User.redisCacheExpiration
			});
		}
	}

	static async createFromCache (options) {
		if (!sb.Cache) {
			throw new sb.Error({
				message: "Cache module is unavailable"
			});
		}

		const key = User.createCacheKey(options);
		const cacheData = await sb.Cache.getByPrefix(key);
		if (!cacheData) {
			return null;
		}

		return new User(cacheData);
	}

	static async invalidateUserCache (identifier) {
		if (identifier instanceof User) {
			User.data.delete(identifier.Name);
			await sb.Cache.delete(identifier);
		}
		else if (typeof identifier === "string") {
			User.data.delete(identifier);

			const cacheKey = User.createCacheKey({ name: identifier });
			await sb.Cache.delete(cacheKey);
		}
		else {
			throw new sb.Error({
				message: "Invalid user identifier provided",
				args: { identifier }
			});
		}
	}

	static createCacheKey (options = {}) {
		const name = options.name ?? options.Name;
		if (typeof name !== "string") {
			throw new sb.Error({
				message: "User name for Cache must be a string",
				args: options
			});
		}

		return `sb-user-${name}`;
	}

	static destroy () {
		User.insertCron.destroy();
		User.data.clear();
	}
};

/**
 * @typedef {"admin"|"owner"|"ambassador"} UserPermissionLevel
 */
