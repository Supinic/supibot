import EventEmitter from "node:events";
import { SupiError, SupiDate } from "supi-core";

import {
	Platform,
	type Like as PlatformLike,
	type GenericSendOptions,
	type PrepareMessageOptions
} from "../platforms/template.js";

import {
	type ChannelDataProperty,
	type ChannelDataPropertyMap,
	type GenericFetchData,
	fetchChannelDataProperty,
	isCachedChannelProperty,
	saveChannelDataProperty
} from "./custom-data-properties.js";

import { User } from "./user.js";
import createMessageLoggingTable from "../utils/create-db-table.js";
import { TemplateWithId } from "./template.js";
import type { Emote } from "../@types/globals.js";

export const privateMessageChannelSymbol /* : unique symbol */ = Symbol("private-message-channel");

type BanphraseDowntimeBehaviour = "Ignore" | "Notify" | "Nothing" | "Refuse" | "Whisper";
type Mode = "Inactive" | "Last seen" | "Read" | "Write" | "VIP" | "Moderator";
type LogType = "Lines" | "Meta";

type EditableProperty = "Name" | "Mode" | "Mention" | "NSFW" | "Mirror" | "Description"
	| "Links_Allowed" | "Banphrase_API_Downtime" | "Banphrase_API_Type" | "Banphrase_API_URL";
type ConstructorData = Pick<Channel,
	"ID" | "Name" | "Specific_ID" | "Mode" | "Mention" | "Message_Limit"
	| "NSFW" | "Mirror" | "Description" | "Links_Allowed"
	| "Banphrase_API_Downtime" | "Banphrase_API_Type" | "Banphrase_API_URL"
> & {
	Logging: LogType[];
	Platform: number;
};

type MirrorOptions = {
	commandUsed?: boolean; // @todo move to Platform
};

type DatabaseChannelData = {
	Channel: number;
	Property: string;
	Value: string;
	Created: SupiDate;
	Edited: SupiDate | null;
};

// type GetObjectEmoteOptions = GetEmoteOptions & { returnEmoteObject: true; };
// type GetStringEmoteOptions = GetEmoteOptions & { returnEmoteObject?: false; };

export type Like = string | number | Channel;

type MoveDataOptions = {
	deleteOriginalValues?: boolean;
	skipProperties?: string[];
};

export const isChannel = (input: unknown): input is Channel => Boolean(input && input instanceof Channel);

export class Channel extends TemplateWithId {
	readonly ID: number;
	readonly Name: string;
	readonly Platform: Platform;
	readonly Specific_ID: string | null;
	Mode: Mode;
	readonly Mention: boolean;
	readonly Links_Allowed: boolean;
	readonly Banphrase_API_Type: "Pajbot" | null;
	readonly Banphrase_API_URL: string | null;
	readonly Banphrase_API_Downtime: BanphraseDowntimeBehaviour | null;
	readonly Message_Limit: number | null;
	readonly NSFW: boolean;
	readonly Logging: Set<LogType>;
	readonly Mirror: Channel["ID"] | null;
	readonly Description: string | null;

	readonly sessionData: Record<string, string> = {};
	readonly events: EventEmitter = new EventEmitter();

	static redisPrefix = "sb-channel";
	static dataCache: WeakMap<Channel, Partial<ChannelDataPropertyMap>> = new WeakMap();
	static uniqueIdentifier = "ID";
	static data: Map<Platform, Map<Channel["Name"], Channel>> = new Map();

	#setupLoggingTablePromise: Promise<{ success: boolean }> | null = null;

	constructor (data: ConstructorData) {
		super();

		this.ID = data.ID;
		this.Name = data.Name;
		this.Specific_ID = data.Specific_ID ?? null;
		this.Mode = data.Mode;
		this.Mention = data.Mention;
		this.Links_Allowed = data.Links_Allowed;
		this.Banphrase_API_Type = data.Banphrase_API_Type;
		this.Banphrase_API_URL = data.Banphrase_API_URL;
		this.Banphrase_API_Downtime = data.Banphrase_API_Downtime;
		this.Message_Limit = data.Message_Limit;
		this.NSFW = data.NSFW;
		this.Logging = new Set(data.Logging);
		this.Mirror = data.Mirror;
		this.Description = data.Description ?? null;

		const platformData = Platform.get(data.Platform);
		if (!platformData) {
			throw new SupiError({
				message: "Invalid Platform provided for Channel"
			});
		}

		this.Platform = platformData;
	}

	setupLoggingTable () {
		if (this.#setupLoggingTablePromise) {
			return this.#setupLoggingTablePromise;
		}

		const prefix = (this.Platform.Name === "twitch")
			? ""
			: `${this.Platform.getFullName("_")}_`;

		const name = `${prefix}${this.Name.toLowerCase()}`;
		this.#setupLoggingTablePromise = createMessageLoggingTable(name);
		return this.#setupLoggingTablePromise;
	}

	waitForUserMessage (userData: User, options: { timeout?: number; }) {
		return this.Platform.waitForUserMessage(this, userData, options);
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

	isUserChannelOwner (userData: User) {
		return this.Platform.isUserChannelOwner(this, userData);
	}

	async isUserAmbassador (userData: User): Promise<boolean> {
		const ambassadors = await this.getDataProperty("ambassadors") ?? [];
		return ambassadors.includes(userData.ID);
	}

	async send (message: string, options: GenericSendOptions = {}): Promise<void> {
		await this.Platform.send(message, this, options);
	}

	async isLive (): Promise<boolean | null> {
		return await this.Platform.isChannelLive(this);
	}

	async toggleAmbassador (userData: User): Promise<void> {
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

	async saveProperty <T extends EditableProperty> (property: T, value: this[T]) {
		const row = await core.Query.getRow<ConstructorData>("chat_data", "Channel");
		await row.load(this.ID);

		await super.saveRowProperty(row, property, value, this);
	}

	async mirror (message: string, userData: User | null, options: MirrorOptions = {}) {
		if (this.Mirror === null) {
			return;
		}

		const targetChannel = Channel.get(this.Mirror);
		if (!targetChannel) {
			throw new SupiError({
				message: "Invalid channel mirror configuration",
				args: { sourceChannel: this.ID }
			});
		}

		await this.Platform.mirror(message, userData, this, options);
	}

	async fetchUserList (): Promise<string[]> {
		return await this.Platform.fetchChannelUserList(this);
	}

	async fetchEmotes (): Promise<Emote[]> {
		const channelEmotes = (await this.getCacheData("emotes") as Emote[] | null)
			?? await this.Platform.fetchChannelEmotes(this);

		await this.setCacheData("emotes", channelEmotes, {
			expiry: 3_600_000 // 1 hour channel emotes cache
		});

		const globalEmotes = await this.Platform.fetchGlobalEmotes();
		return [...globalEmotes, ...channelEmotes];
	}

	async invalidateEmotesCache (): Promise<void> {
		await this.setCacheData("emotes", null);
	}

	async prepareMessage (message: string, options: PrepareMessageOptions = {}): Promise<string | false> {
		return await this.Platform.prepareMessage(message, this, options);
	}

	async getDataProperty <T extends ChannelDataProperty> (
		propertyName: T,
		options: GenericFetchData = {}
	): Promise<ChannelDataPropertyMap[T]> {
		if (!options.forceCacheReload && isCachedChannelProperty(propertyName)) {
			const cache = Channel.dataCache.get(this);
			if (cache && cache[propertyName]) {
				return cache[propertyName];
			}
		}

		const value = await fetchChannelDataProperty(propertyName, this.ID, options);
		if (value === null) {
			return null;
		}

		this.setPropertyCache(propertyName, value);

		return value;
	}

	async setDataProperty <T extends ChannelDataProperty> (
		propertyName: T,
		value: ChannelDataPropertyMap[T] | null,
		options: GenericFetchData = {}
	) {
		await saveChannelDataProperty(propertyName, value, this.ID, options);
		this.setPropertyCache(propertyName, value);
	}

	private setPropertyCache <T extends ChannelDataProperty> (propertyName: T, value: ChannelDataPropertyMap[T]) {
		if (!isCachedChannelProperty(propertyName)) {
			return;
		}

		let cache = Channel.dataCache.get(this);
		if (!cache) {
			cache = {};
			Channel.dataCache.set(this, cache);
		}

		cache[propertyName] = value;
	}

	getCacheKey () {
		return `sb-channel-${this.ID}`;
	}

	destroy () {
		this.events.removeAllListeners();
	}

	static async initialize () {
		await Channel.loadData();
	}

	static async loadData () {
		const data = await core.Query.getRecordset<ConstructorData[]>((rs) => rs
			.select("*")
			.from("chat_data", "Channel")
		);

		for (const platformMap of Channel.data.values()) {
			for (const channelData of platformMap.values()) {
				channelData.destroy();
			}

			platformMap.clear();
		}

		for (const row of data) {
			const channelData = new Channel(row);
			const platformMap = Channel.getPlatformMap(channelData.Platform);
			platformMap.set(channelData.Name, channelData);
		}

		if (Channel.data.size === 0) {
			console.warn("No channels initialized - bot will not attempt to join any channels");
		}
	}

	static async reloadData () {
		await Channel.loadData();
	}

	static get (identifier: Like, platformIdentifier?: Platform | string | number): Channel | null {
		let platform: Platform | undefined;
		if (platformIdentifier) {
			const platformData = Platform.get(platformIdentifier);
			if (!platformData) {
				throw new SupiError({
					message: "Invalid platform provided"
				});
			}

			platform = platformData;
		}

		if (identifier instanceof Channel) {
			return identifier;
		}
		else if (typeof identifier === "string") {
			const channelName = Channel.normalizeName(identifier);

			if (platform) {
				const platformMap = Channel.data.get(platform);
				if (!platformMap) {
					return null;
				}

				return platformMap.get(channelName) ?? null;
			}
			else {
				for (const platformMap of Channel.data.values()) {
					const channelData = platformMap.get(channelName);
					if (channelData) {
						return channelData;
					}
				}
			}
		}
		else {
			for (const platformMap of Channel.data.values()) {
				for (const channelData of platformMap.values()) {
					if (channelData.ID === identifier) {
						return channelData;
					}
				}
			}
		}

		return null;
	}

	static getAsserted (identifier: string | number, platformIdentifier?: Platform | string | number): Channel {
		const channel = Channel.get(identifier, platformIdentifier);
		if (!channel) {
			throw new SupiError({
				message: `Assert error: asserted Channel ${identifier} is not available`
			});
		}

		return channel;
	}

	static getBySpecificId (identifier: Channel["Specific_ID"], platform: Platform | string | number) {
		const platformData = Platform.get(platform);
		if (!platformData) {
			throw new SupiError({
				message: "Invalid platform provided",
				args: { identifier }
			});
		}

		const channels = Channel.getPlatformMap(platformData);
		for (const channelData of channels.values()) {
			if (channelData.Mode !== "Inactive" && channelData.Specific_ID === identifier) {
				return channelData;
			}
		}

		return null;
	}

	static getJoinableForPlatform (platform: PlatformLike) {
		const platformData = Platform.get(platform);
		if (!platformData) {
			throw new SupiError({
				message: "Invalid platform provided"
			});
		}

		const platformMap = Channel.data.get(platformData);
		if (!platformMap) {
			return [];
		}

		const result = [];
		for (const channelData of platformMap.values()) {
			if (channelData.Mode !== "Inactive") {
				result.push(channelData);
			}
		}

		return result;
	}

	static getActivePlatforms () {
		const activePlatforms = [];
		for (const [platformData, platformMap] of Channel.data.entries()) {
			for (const channelData of platformMap.values()) {
				if (channelData.Mode !== "Inactive") {
					activePlatforms.push(platformData);
					break;
				}
			}
		}

		return activePlatforms;
	}

	static async getLiveEventSubscribedChannels (platform: Platform | null = null) {
		const eventChannelIDs = await core.Query.getRecordset<Channel["ID"][]>(rs => rs
			.select("Channel")
			.from("chat_data", "Channel_Chat_Module")
			.where("Chat_Module IN %s+", ["offline-only-mode", "offline-only-mirror"])
			.where("Channel IS NOT NULL")
			.groupBy("Channel")
			.flat("Channel")
		);

		const configChannelIDs = await core.Query.getRecordset<Channel["ID"][]>(rs => rs
			.select("Channel")
			.from("chat_data", "Channel_Data")
			.where("Property = %s", "offlineOnlyBot")
			.where("Channel IS NOT NULL")
			.groupBy("Channel")
			.flat("Channel")
		);

		const filterChannelIDs = await core.Query.getRecordset<Channel["ID"][]>(rs => rs
			.select("Channel")
			.from("chat_data", "Filter")
			.where("Type IN %s+", ["Online-only", "Offline-only"])
			.where("Active = %b", true)
			.where("Channel IS NOT NULL")
			.groupBy("Channel")
			.flat("Channel")
		);

		const channelIDs = new Set([...eventChannelIDs, ...configChannelIDs, ...filterChannelIDs]);
		let channelsData = [...channelIDs].map(i => Channel.get(i)).filter(Boolean) as Channel[];
		if (platform) {
			channelsData = channelsData.filter(i => i.Platform === platform);
		}

		return channelsData;
	}

	static async add (name: Channel["Name"], platformData: Platform, mode: Mode = "Write", specificID: Channel["Specific_ID"]) {
		const channelName = Channel.normalizeName(name);
		const existing = Channel.get(channelName);
		if (existing) {
			return existing;
		}

		// Creates Channel row
		const row = await core.Query.getRow<ConstructorData>("chat_data", "Channel");
		row.setValues({
			Name: channelName,
			Platform: platformData.ID,
			Mode: mode,
			Specific_ID: specificID ?? null
		});
		await row.save();

		const channelData = new Channel({ ...row.valuesObject });
		const platformMap = Channel.getPlatformMap(channelData.Platform);
		platformMap.set(channelName, channelData);

		return channelData;
	}

	static async moveData (oldChannelData: Channel, newChannelData: Channel, options: MoveDataOptions = {}) {
		type MoveData = { Property: string; Value: string; };
		const properties = await core.Query.getRecordset<MoveData[]>((rs) => rs
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

			const propertyRow = await core.Query.getRow<DatabaseChannelData>("chat_data", "Channel_Data");
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
			await core.Query.getRecordDeleter(rd => rd
				.delete()
				.from("chat_data", "Channel_Data")
				.where("Channel = %n", oldChannelData.ID)
			);
		}
	}

	static async reloadSpecific (...list: Channel["Name"][]) {
		const channelsData = list.map(i => Channel.get(i)).filter(Boolean) as Channel[];
		if (channelsData.length === 0) {
			return false;
		}

		const data = await core.Query.getRecordset<ConstructorData[]>(rs => rs
			.select("*")
			.from("chat_data", "Channel")
			.where("ID IN %n+", channelsData.map(i => i.ID))
		);

		for (const channelData of channelsData) {
			const platformMap = Channel.getPlatformMap(channelData.Platform);
			const channelName = channelData.Name;

			channelData.destroy();
			platformMap.delete(channelName);
		}

		for (const row of data) {
			const newChannelData = new Channel(row);
			const platformMap = Channel.getPlatformMap(newChannelData.Platform);
			platformMap.set(newChannelData.Name, newChannelData);
		}

		return true;
	}

	static getPlatformMap (platformData: Platform): Map<Channel["Name"], Channel> {
		if (!Channel.data.has(platformData)) {
			Channel.data.set(platformData, new Map());
		}

		// type cast due to condition above
		return Channel.data.get(platformData) as Map<Channel["Name"], Channel>;
	}

	static normalizeName (username: string): string {
		return username.toLowerCase().replace(/^@/, "");
	}
}

export default Channel;
