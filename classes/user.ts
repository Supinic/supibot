import { SupiDate } from "supi-core";
import type { CacheValue, Batch, Recordset, Row } from "supi-core";
import { TemplateWithIdString, getGenericDataProperty, setGenericDataProperty } from "./template.js";
import type { GenericDataPropertyObject } from "./template.js";

import config from "../config.json" with { type: "json" };

type ConstructorData = {
	ID: User["ID"];
	Name: User["Name"];
	Twitch_ID: User["Twitch_ID"];
	Discord_ID: User["Discord_ID"];
	Started_Using: User["Started_Using"] | null;
};
type GenericFetchData = GenericDataPropertyObject<User>["options"];
type GetOptions = Partial<Pick<ConstructorData, "Twitch_ID" | "Discord_ID">>;

type UserLike = User | User["Name"] | User["ID"];
type NameObject = {
	name?: User["Name"];
	Name?: User["Name"];
};

const HIGH_LOAD_CACHE_PREFIX = "sb-user-high-load" as const;
const HIGH_LOAD_CACHE_EXPIRY = 60_000 as const;

export class User extends TemplateWithIdString {
	readonly ID: number;
	readonly Discord_ID: string | null;
	readonly Twitch_ID: string | null;
	readonly Name: string;
	readonly Started_Using: SupiDate;

	static readonly mapCacheExpiration = 300_000 as const;
	static readonly redisCacheExpiration = 3_600_000 as const;
	static readonly mapExpirationInterval = setInterval(() => User.data.clear(), User.mapCacheExpiration);

	static data: Map<string, User> = new Map();
	static readonly dataCache = new WeakMap();
	static readonly pendingNewUsers = new Map();

	static readonly permissions = {
		regular: 0b0000_0001,
		ambassador: 0b0000_0010,
		channelOwner: 0b0000_0100,
		administrator: 0b1000_0000
	} as const;

	static highLoadUserBatch: Batch;
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
	}, HIGH_LOAD_CACHE_EXPIRY);

	constructor (data: ConstructorData) {
		super();

		this.ID = data.ID;
		this.Discord_ID = data.Discord_ID;
		this.Twitch_ID = data.Twitch_ID;
		this.Name = data.Name;
		this.Started_Using = (data.Started_Using === null)
			? new sb.Date(data.Started_Using)
			: data.Started_Using;
	}

	getCacheKey () {
		return `sb-user-${this.Name}`;
	}

	async saveProperty<T extends keyof ConstructorData> (property: T, value: this[T]) {
		const row: Row = await sb.Query.getRow("chat_data", "User_Alias");
		await row.load(this.ID);

		await super.saveRowProperty(row, property, value, this);

		await User.invalidateUserCache(this);
		await User.populateCaches(this);
	}

	async getDataProperty (propertyName: string, options: GenericFetchData = {}) {
		return await getGenericDataProperty({
			cacheMap: User.dataCache,
			databaseProperty: "User_Alias",
			databaseTable: "User_Alias_Data",
			instance: this,
			propertyContext: "User",
			options,
			propertyName
		});
	}

	async setDataProperty (propertyName: string, value: CacheValue, options: GenericFetchData) {
		return await setGenericDataProperty(this, {
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

	destroy () {}

	static async get (identifier: UserLike, strict: boolean = true, options: GetOptions = {}): Promise<User | null> {
		if (identifier instanceof User) {
			return identifier;
		}
		else if (typeof identifier === "number") {
			const mapCacheUser = User.getByProperty("ID", identifier);
			if (mapCacheUser) {
				return mapCacheUser;
			}

			const name = await sb.Query.getRecordset((rs: Recordset) => rs
				.select("Name")
				.from("chat_data", "User_Alias")
				.where("ID = %n", identifier)
				.single()
				.flat("Name")
			) as string | undefined;

			if (!name) {
				return null;
			}

			return User.get(name, strict, options);
		}
		else {
			const username = User.normalizeUsername(identifier);

			// 1. attempt to fetch the user from low-cache (User.data)
			const mapCacheUser = User.data.get(username);
			if (mapCacheUser) {
				return mapCacheUser;
			}

			// 2. attempt to fetch the user from medium-cache (sb.Cache)
			if (sb.Cache && sb.Cache.ready) {
				const redisCacheUser = await User.createFromCache({ name: username });
				if (redisCacheUser) {
					if (!User.data.has(username)) {
						User.data.set(username, redisCacheUser);
					}

					return redisCacheUser;
				}
			}

			// 3. attempt to get the user out of the database
			const dbUserData = await sb.Query.getRecordset((rs: Recordset) => rs
				.select("*")
				.from("chat_data", "User_Alias")
				.where("Name = %s", username)
				.single()
			) as ConstructorData | undefined;

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

				// 4-1. If high-load (batching) or critical-load (no inserts) are enabled,
				// don't populate caches and immediately return `null`.
				if (!userData) {
					return null;
				}
			}
			// 5. If strict mode is on and the user does not exist, return null and exit
			else {
				return null;
			}

			await User.populateCaches(userData);
			return userData;
		}
	}

	static async getMultiple (identifiers: UserLike[]) {
		const result: User[] = [];
		const toFetch: (string | number)[] = [];
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
			else {
				const username = User.normalizeUsername(identifier);
				const mapCacheUser = User.data.get(username);
				if (mapCacheUser) {
					result.push(mapCacheUser);
					continue;
				}

				if (sb.Cache && sb.Cache.ready) {
					const redisCacheUser = await User.createFromCache({ name: username });
					if (redisCacheUser) {
						User.data.set(username, redisCacheUser);
						result.push(redisCacheUser);
						continue;
					}
				}

				toFetch.push(username);
			}
		}

		if (toFetch.length > 0) {
			// @todo remove type casts when Utils is well-known
			const [strings, numbers] = sb.Utils.splitByCondition(toFetch, (i: string | number) => typeof i === "string") as [string[], number[]];
			const fetched = await sb.Query.getRecordset((rs: Recordset) => {
				rs.select("*");
				rs.from("chat_data", "User_Alias");

				if (strings.length > 0 && numbers.length > 0) {
					rs.where("Name IN %s+ OR ID IN %n+", strings, numbers);
				}
				else if (strings.length > 0) {
					rs.where("Name IN %s+", strings);
				}
				else if (numbers.length > 0) {
					rs.where("ID IN %n+", numbers);
				}
			}) as ConstructorData[];

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

	static getByProperty<T extends keyof ConstructorData> (property: T, identifier: User[T]) {
		for (const user of User.data.values()) {
			if (user[property] === identifier) {
				return user;
			}
		}
	}

	static normalizeUsername (username: string) {
		return username
			.toLowerCase()
			.replace(/^@/, "")
			.replace(/^#/, "")
			.replaceAll(/:$/g, "")
			.replaceAll(/\s+/g, "_");
	}

	static async add (name: string, properties = {}) {
		await sb.Cache.setByPrefix(`${HIGH_LOAD_CACHE_PREFIX}-${name}`, "1", {
			expiry: HIGH_LOAD_CACHE_EXPIRY
		});

		const preparedName = User.normalizeUsername(name);
		if (User.pendingNewUsers.has(preparedName)) {
			return User.pendingNewUsers.get(preparedName);
		}

		const keys = await sb.Cache.getKeysByPrefix(`${HIGH_LOAD_CACHE_PREFIX}*`);
		if (keys.length > config.values.userAdditionCriticalLoadThreshold) {
			return null;
		}
		else if (keys.length > config.values.userAdditionHighLoadThreshold) {
			User.pendingNewUsers.set(preparedName, null);

			if (User.highLoadUserBatch) {
				User.highLoadUserBatch.add({
					Name: preparedName,
					...properties
				});
			}

			return null;
		}
		else {
			const promise = (async () => {
				const existingName = await sb.Query.getRecordset((rs: Recordset) => rs
					.select("Name")
					.from("chat_data", "User_Alias")
					.where("Name = %s", preparedName)
					.limit(1)
					.flat("Name")
					.single()
				) as string | undefined;

				if (existingName) {
					User.pendingNewUsers.delete(preparedName);
					return await User.get(existingName);
				}

				return await User.#add(preparedName, properties);
			})();

			User.pendingNewUsers.set(preparedName, promise);
			return await promise;
		}
	}

	static async #add (name: string, properties: GetOptions) {
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

	static async populateCaches (user: User) {
		if (!User.data.has(user.Name)) {
			User.data.set(user.Name, user);
		}

		if (sb.Cache && sb.Cache.ready) {
			await sb.Cache.setByPrefix(user.getCacheKey(), user, {
				expiry: User.redisCacheExpiration
			});
		}
	}

	static async createFromCache (options: NameObject) {
		const key = User.createCacheKey(options);
		const cacheData = await sb.Cache.getByPrefix(key) as ConstructorData | undefined;
		if (!cacheData) {
			return null;
		}

		return new User(cacheData);
	}

	static async invalidateUserCache (identifier: User | string) {
		if (identifier instanceof User) {
			User.data.delete(identifier.Name);
			await sb.Cache.delete(identifier);
		}
		else {
			User.data.delete(identifier);

			const cacheKey = User.createCacheKey({ name: identifier });
			await sb.Cache.delete(cacheKey);
		}
	}

	static createCacheKey (options: NameObject = {}) {
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
		clearInterval(User.mapExpirationInterval);
		User.data.clear();
	}
}

export default User;

/**
 * @typedef {"admin"|"owner"|"ambassador"} UserPermissionLevel
 */
