import { SupiDate, SupiError, type Batch, type Row } from "supi-core";
import { TemplateWithIdString } from "./template.js";

import { getConfig } from "../config.js";
const { userAdditionCriticalLoadThreshold, userAdditionHighLoadThreshold } = getConfig().values;

import {
	type UserDataProperty,
	type UserDataPropertyMap,
	type GenericFetchData,
	fetchUserDataProperty,
	isCachedUserProperty,
	saveUserDataProperty
} from "./custom-data-properties.js";

type ConstructorData = {
	ID: User["ID"];
	Name: User["Name"];
	Twitch_ID: User["Twitch_ID"];
	Discord_ID: User["Discord_ID"];
	Started_Using: User["Started_Using"] | number | null;
};
type UserCacheData = ConstructorData & {
	Started_Using: number | null;
};

type GetOptions = Partial<Pick<ConstructorData, "Twitch_ID" | "Discord_ID">>;

export type Like = User | User["Name"] | User["ID"];
type NameObject = {
	name?: User["Name"];
	Name?: User["Name"];
};

const HIGH_LOAD_CACHE_PREFIX = "sb-user-high-load";
const HIGH_LOAD_CACHE_EXPIRY = 60_000;
const pendingUserAdditionPromises: Map<User["Name"], Promise<User | null>> = new Map();

export const permissions = {
	regular: 0b0000_0001,
	ambassador: 0b0000_0010,
	channelOwner: 0b0000_0100,
	administrator: 0b1000_0000
} as const;
export const permissionNames = {
	REGULAR: "regular",
	AMBASSADOR: "ambassador",
	CHANNEL_OWNER: "channelOwner",
	ADMINISTRATOR: "administrator"
} as const satisfies Record<string, keyof typeof permissions>;
export type PermissionNumbers = (typeof User.permissions[keyof typeof User.permissions]);

export class User extends TemplateWithIdString {
	readonly ID: number;
	readonly Discord_ID: string | null;
	readonly Twitch_ID: string | null;
	readonly Name: string;
	readonly Started_Using: SupiDate;

	static readonly data: Map<string, User> = new Map();
	private static lastUserDataClear = 0;
	static readonly mapCacheExpiration = 300_000;
	static readonly redisCacheExpiration = 3_600_000;

	static readonly dataCache: WeakMap<User, Partial<UserDataPropertyMap>> = new WeakMap();
	static readonly pendingNewUsers: Map<User["Name"], Promise<User> | null> = new Map();

	static readonly permissions = permissions;

	static highLoadUserBatch: Batch | undefined;
	static highLoadUserInterval: NodeJS.Timeout;
	static {
		User.highLoadUserInterval = setInterval(() => void User.handleHighLoad(), HIGH_LOAD_CACHE_EXPIRY).unref();
	}

	constructor (data: ConstructorData) {
		super();

		this.ID = data.ID;
		this.Discord_ID = data.Discord_ID;
		this.Twitch_ID = data.Twitch_ID;
		this.Name = data.Name;

		this.Started_Using = (data.Started_Using === null)
			? new SupiDate()
			: new SupiDate(data.Started_Using);
	}

	getCacheKey () {
		return `sb-user-${this.Name}`;
	}

	async saveProperty<T extends keyof ConstructorData> (property: T, value: this[T]) {
		const row: Row = await core.Query.getRow<ConstructorData>("chat_data", "User_Alias");
		await row.load(this.ID);

		await super.saveRowProperty(row, property, value, this);

		await User.invalidateUserCache(this);
		await User.populateCaches(this);
	}

	async getDataProperty <T extends UserDataProperty> (
		propertyName: T,
		options: GenericFetchData = {}
	): Promise<UserDataPropertyMap[T]> {
		if (!options.forceCacheReload && isCachedUserProperty(propertyName)) {
			const cache = User.dataCache.get(this);
			if (cache && cache[propertyName]) {
				return cache[propertyName];
			}
		}

		const value = await fetchUserDataProperty(propertyName, this.ID, options);
		if (value === null) {
			return null;
		}

		this.setPropertyCache(propertyName, value);

		return value;
	}

	async setDataProperty <T extends UserDataProperty> (
		propertyName: T,
		value: UserDataPropertyMap[T],
		options: GenericFetchData = {}
	) {
		await saveUserDataProperty(propertyName, value, this.ID, options);
		this.setPropertyCache(propertyName, value);
	}

	private setPropertyCache <T extends UserDataProperty> (propertyName: T, value: UserDataPropertyMap[T]) {
		if (!isCachedUserProperty(propertyName)) {
			return;
		}

		let cache = User.dataCache.get(this);
		if (!cache) {
			cache = {};
			User.dataCache.set(this, cache);
		}

		cache[propertyName] = value;
	}

	private getCacheProperties (): UserCacheData {
		return {
			ID: this.ID,
			Name: this.Name,
			Twitch_ID: this.Twitch_ID,
			Discord_ID: this.Discord_ID,
			Started_Using: this.Started_Using.valueOf()
		};
	}

	destroy () {}

	static async initialize () {}

	static async get (identifier: Like, strict: boolean = true, options: GetOptions = {}): Promise<User | null> {
		const now = SupiDate.now();
		if (now >= (User.lastUserDataClear + User.mapCacheExpiration)) {
			User.data.clear();
			User.lastUserDataClear = now;
		}

		if (identifier instanceof User) {
			return identifier;
		}
		else if (typeof identifier === "number") {
			const mapCacheUser = User.getByProperty("ID", identifier);
			if (mapCacheUser) {
				return mapCacheUser;
			}

			const name = await core.Query.getRecordset<string | undefined>(rs => rs
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
		else {
			const username = User.normalizeUsername(identifier);

			// 1. attempt to fetch the user from low-cache (User.data)
			const mapCacheUser = User.data.get(username);
			if (mapCacheUser) {
				return mapCacheUser;
			}

			// 2. attempt to fetch the user from medium-cache (core.Cache)
			if (core.Cache.ready) {
				const redisCacheUser = await User.createFromCache({ name: username });
				if (redisCacheUser) {
					if (!User.data.has(username)) {
						User.data.set(username, redisCacheUser);
					}

					return redisCacheUser;
				}
			}

			// 3. attempt to get the user out of the database
			const dbUserData = await core.Query.getRecordset<ConstructorData | undefined>(rs => rs
				.select("*")
				.from("chat_data", "User_Alias")
				.where("Name = %s", username)
				.single()
			);

			let userData: User;
			if (dbUserData) {
				userData = new User(dbUserData);
			}
			// 4. If strict mode is off, create the user and return the instance immediately
			else if (!strict) {
				// Prevent duplicate additions while the same username is pending in database
				const existingPromise = pendingUserAdditionPromises.get(username);
				if (existingPromise) {
					return existingPromise;
				}

				const newUserDataPromise = User.add(username, {
					Discord_ID: options.Discord_ID ?? null,
					Twitch_ID: options.Twitch_ID ?? null
				});
				pendingUserAdditionPromises.set(username, newUserDataPromise);

				const newlyAddedUserData = await newUserDataPromise;
				pendingUserAdditionPromises.delete(username);

				// 4-1. If high-load (batching) or critical-load (no inserts) are enabled,
				// don't populate caches and immediately return `null`.
				if (!newlyAddedUserData) {
					return null;
				}

				userData = newlyAddedUserData;
			}
			// 5. If strict mode is on and the user does not exist, return null and exit
			else {
				return null;
			}

			await User.populateCaches(userData);
			return userData;
		}
	}

	static async getAsserted (identifier: string | number): Promise<User> {
		const userData = await User.get(identifier, true);
		if (!userData) {
			throw new SupiError({
			    message: "Assert error: User.getAsserted did not find User",
				args: { identifier }
			});
		}

		return userData;
	}

	static async getMultiple (identifiers: Like[]) {
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

				if (core.Cache.ready) {
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
			const [strings, numbers] = core.Utils.splitByCondition(toFetch, (i: string | number) => typeof i === "string") as [string[], number[]];
			const fetched = await core.Query.getRecordset<ConstructorData[]>(rs => {
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

				return rs;
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

	static getByProperty<T extends keyof ConstructorData> (property: T, identifier: User[T]) {
		for (const user of User.data.values()) {
			if (user[property] === identifier) {
				return user;
			}
		}

		return null;
	}

	static normalizeUsername (username: string) {
		return username
			.toLowerCase()
			.replace(/^@/, "")
			.replace(/^#/, "")
			.replaceAll(/:$/g, "")
			.replaceAll(/\s+/g, "_");
	}

	static async add (name: string, properties = {}): Promise<User | null> {
		await core.Cache.setByPrefix(`${HIGH_LOAD_CACHE_PREFIX}-${name}`, "1", {
			expiry: HIGH_LOAD_CACHE_EXPIRY
		});

		const preparedName = User.normalizeUsername(name);
		const pendingNewUser = User.pendingNewUsers.get(preparedName);
		if (typeof pendingNewUser !== "undefined") {
			return pendingNewUser;
		}

		const keys = await core.Cache.getKeysByPrefix(`${HIGH_LOAD_CACHE_PREFIX}*`);

		// If there are too many new users queued (above criticalLoadThreshold), all new users being added are skipped
		if (keys.length > userAdditionCriticalLoadThreshold) {
			return null;
		}
		// If there are many new users queued (above highLoadThreshold), new users will be batched instead
		else if (keys.length > userAdditionHighLoadThreshold) {
			User.pendingNewUsers.set(preparedName, null);

			if (User.highLoadUserBatch) {
				User.highLoadUserBatch.add({
					Name: preparedName,
					...properties
				});
			}

			return null;
		}
		// If the number of new users is manageable, immediately add the new user and return the User object
		else {
			const promise = (async () => {
				const existingName = await core.Query.getRecordset<string | undefined>(rs => rs
					.select("Name")
					.from("chat_data", "User_Alias")
					.where("Name = %s", preparedName)
					.limit(1)
					.flat("Name")
					.single()
				);

				if (existingName) {
					User.pendingNewUsers.delete(preparedName);
					return await User.get(existingName) as User; // Guaranteed because of the condition above
				}

				return await User.#add(preparedName, properties);
			})();

			User.pendingNewUsers.set(preparedName, promise);
			return await promise;
		}
	}

	static async #add (name: string, properties: GetOptions) {
		const row = await core.Query.getRow<ConstructorData>("chat_data", "User_Alias");
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

		if (core.Cache.ready) {
			await core.Cache.setByPrefix(user.getCacheKey(), user.getCacheProperties(), {
				expiry: User.redisCacheExpiration
			});
		}
	}

	static async createFromCache (options: NameObject) {
		const key = User.createCacheKey(options);
		const cacheData = await core.Cache.getByPrefix(key) as UserCacheData | undefined;
		if (!cacheData) {
			return null;
		}

		return new User(cacheData);
	}

	static async invalidateUserCache (identifier: User | string) {
		if (identifier instanceof User) {
			User.data.delete(identifier.Name);
			await core.Cache.delete(identifier);
		}
		else {
			User.data.delete(identifier);

			const cacheKey = User.createCacheKey({ name: identifier });
			await core.Cache.delete(cacheKey);
		}
	}

	static async handleHighLoad () {
		User.highLoadUserBatch ??= await core.Query.getBatch(
			"chat_data",
			"User_Alias",
			["Name", "Twitch_ID", "Discord_ID"]
		);

		if (!User.highLoadUserBatch.ready) {
			return;
		}

		const users = User.highLoadUserBatch.records.map(i => i.Name) as User["Name"][];
		await User.highLoadUserBatch.insert();

		for (const user of users) {
			User.pendingNewUsers.delete(user);
		}
	}

	static createCacheKey (options: NameObject = {}) {
		const name = options.name ?? options.Name;
		if (typeof name !== "string") {
			throw new SupiError({
				message: "User name for Cache must be a string",
				args: options
			});
		}

		return `sb-user-${name}`;
	}

	static destroy () {
		clearInterval(User.highLoadUserInterval);
		User.data.clear();
	}
}

export default User;
