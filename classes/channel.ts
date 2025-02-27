import EventEmitter from "node:events";

import { type Recordset, type RecordDeleter, SupiError, type Row } from "supi-core";

import { type GetEmoteOptions, Platform } from "../platforms/template.js";
import { User } from "./user.js";
import createMessageLoggingTable from "../utils/create-db-table.js";
import {
	GenericDataPropertyValue,
	getGenericDataProperty,
	setGenericDataProperty,
	TemplateWithId
} from "./template.js";

export const privateMessageChannelSymbol /* : unique symbol */ = Symbol("private-message-channel");

type BanphraseDowntimeBehaviour = "Ignore" | "Notify" | "Nothing" | "Refuse" | "Whisper";
type Mode = "Inactive" | "Last seen" | "Read" | "Write" | "VIP" | "Moderator";
type LogType = "Lines" | "Meta";

type EditableProperty = "Mode" | "Mention"  | "NSFW" | "Mirror" | "Description"
	| "Links_Allowed" | "Banphrase_API_Downtime" | "Banphrase_API_Type" | "Banphrase_API_URL";
type ConstructorData = Pick<Channel,
	"ID" | "Name" | "Platform" | "Specific_ID" | "Mode" | "Mention" | "Message_Limit"
	| "NSFW" | "Logging" | "Mirror" | "Description" | "Links_Allowed"
	| "Banphrase_API_Downtime" | "Banphrase_API_Type" | "Banphrase_API_URL"
> & { Platform: Platform["ID"]; };

type MirrorOptions = {
	commandUsed?: boolean; // @todo move to Platform
};


// type GetObjectEmoteOptions = GetEmoteOptions & { returnEmoteObject: true; };
// type GetStringEmoteOptions = GetEmoteOptions & { returnEmoteObject?: false; };

export type Like = string | number | Channel;

export type Emote = { // @todo move to Platform
	type: "discord" | "twitch" | "bttv" | "7tv";
	ID: string | number;
	name: string;
	global: boolean;
	guild?: string;
	animated: boolean;
	zeroWidth?: boolean;
};

type MoveDataOptions = {
	deleteOriginalValues?: boolean;
	skipProperties?: string[];
};

export class Channel extends TemplateWithId {
	readonly ID: number;
	readonly Name: string;
	readonly Platform: Platform;
	readonly Specific_ID: string | null;
	readonly Mode: Mode;
	readonly Mention: boolean;
	readonly Links_Allowed: boolean;
	readonly Banphrase_API_Type: "Pajbot";
	readonly Banphrase_API_URL: string;
	readonly Banphrase_API_Downtime: BanphraseDowntimeBehaviour;
	readonly Message_Limit: number | null;
	readonly NSFW: boolean;
	readonly Logging: Set<LogType>;
	readonly Mirror: Channel["ID"] | null;
	readonly Description: string | null;

	readonly sessionData: Record<string, string> = {};
	readonly events: EventEmitter = new EventEmitter();

	static redisPrefix = "sb-channel";
	static dataCache = new WeakMap();
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
		this.Logging = new Set(data.Logging ?? []);
		this.Mirror = data.Mirror;
		this.Description = data.Description ?? null;

		const platformData = Platform.get(data.Platform);
		if (!platformData) {
			throw new SupiError({
				message: "Invalid Platform provided for Channel"
			})
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
		const ambassadors = (await this.getDataProperty("ambassadors") ?? []) as User["ID"][];
		return ambassadors.includes(userData.ID);
	}

	send (message: string, options = {}): Promise<void> {
		return this.Platform.send(message, this, options);
	}

	async isLive (): Promise<boolean> {
		return await this.Platform.isChannelLive(this) as unknown as boolean; //@todo remove cast after platforms are Typescript
	}

	async toggleAmbassador (userData: User): Promise<void> {
		const ambassadors = <number[]> await this.getDataProperty("ambassadors", { forceCacheReload: true }) ?? [];
		if (ambassadors.includes(userData.ID)) {
			const index = ambassadors.indexOf(userData.ID);
			ambassadors.splice(index, 1);
		}
		else {
			ambassadors.push(userData.ID);
		}

		await this.setDataProperty("ambassadors", ambassadors);
	}

	async saveProperty <T extends EditableProperty>(property: T, value: this[T]) {
		const row = await sb.Query.getRow("chat_data", "Channel") as Row;
		await row.load(this.ID);

		await super.saveRowProperty(row, property, value, this);
	}

	async mirror (message: string, userData: User | null, options: MirrorOptions = {}) {
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

		return await this.Platform.mirror(message, userData, this, options);
	}

	async fetchUserList (): Promise<string[]> {
		return await this.Platform.fetchChannelUserList(this) as string[]; // @todo remove type cast when Platform is TS
	}

	async fetchEmotes (): Promise<Emote[]> {
		let channelEmotes = await this.getCacheData("emotes") as Emote[] | null;
		if (!channelEmotes) {
			channelEmotes = await this.Platform.fetchChannelEmotes(this) as unknown as Emote[]; // @todo remove force cast when Platform is TS
		}

		await this.setCacheData("emotes", channelEmotes, {
			expiry: 3_600_000 // 1 hour channel emotes cache
		});

		const globalEmotes = await this.Platform.fetchGlobalEmotes();
		return [...globalEmotes, ...channelEmotes];
	}

	async invalidateEmotesCache (): Promise<void> {
		return await this.setCacheData("emotes", null);
	}

	// async getBestAvailableEmote (emotes: string[], fallbackEmote: string, options: GetStringEmoteOptions): Promise<string>;
	// async getBestAvailableEmote (emotes: string[], fallbackEmote: string, options: GetObjectEmoteOptions): Promise<Emote>;
	async getBestAvailableEmote <T extends string> (emotes: T[], fallbackEmote: T, options: GetEmoteOptions = {}): Promise<Emote | T> {
		const availableEmotes = await this.fetchEmotes();
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
					: available.name as T;
			}
		}

		return fallbackEmote;
	}

	async prepareMessage (message: string, options = {}): Promise<string | false> {
		// @todo remove type cast after Platform is TS
		return await this.Platform.prepareMessage(message, this, options) as string | false;
	}

	async getDataProperty (propertyName: string, options = {}) {
		return await getGenericDataProperty({
			cacheMap: Channel.dataCache,
			databaseProperty: "Channel",
			databaseTable: "Channel_Data",
			instance: this,
			propertyContext: "Channel",
			options,
			propertyName
		});
	}

	async setDataProperty (propertyName: string, value: GenericDataPropertyValue, options = {}) {
		return await setGenericDataProperty(this, {
			cacheMap: Channel.dataCache,
			databaseProperty: "Channel",
			databaseTable: "Channel_Data",
			instance: this,
			propertyContext: "Channel",
			propertyName,
			options,
			value
		});
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
		const data = await sb.Query.getRecordset((rs: Recordset) => rs
			.select("*")
			.from("chat_data", "Channel")
		) as ConstructorData[];

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

	static get (identifier: Like, platformIdentifier?: Platform | string | number) {
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
					if (platformMap.has(channelName)) {
						return platformMap.get(channelName);
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

			return null;
		}
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

	static getJoinableForPlatform (platform: Platform | string | number) {
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

	static async getLiveEventSubscribedChannels (platform = null) {
		const eventChannelIDs = await sb.Query.getRecordset((rs: Recordset) => rs
			.select("Channel")
			.from("chat_data", "Channel_Chat_Module")
			.where("Chat_Module IN %s+", ["offline-only-mode", "offline-only-mirror"])
			.where("Channel IS NOT NULL")
			.groupBy("Channel")
			.flat("Channel")
		) as Channel["ID"][];

		const configChannelIDs = await sb.Query.getRecordset((rs: Recordset) => rs
			.select("Channel")
			.from("chat_data", "Channel_Data")
			.where("Property = %s", "offlineOnlyBot")
			.where("Channel IS NOT NULL")
			.groupBy("Channel")
			.flat("Channel")
		) as Channel["ID"][];

		const filterChannelIDs = await sb.Query.getRecordset((rs: Recordset) => rs
			.select("Channel")
			.from("chat_data", "Filter")
			.where("Type IN %s+", ["Online-only", "Offline-only"])
			.where("Active = %b", true)
			.where("Channel IS NOT NULL")
			.groupBy("Channel")
			.flat("Channel")
		) as Channel["ID"][];

		const channelIDs = new Set([...eventChannelIDs, ...configChannelIDs, ...filterChannelIDs]);
		let channelsData = [...channelIDs].map(i => Channel.get(i)).filter(Boolean) as Channel[];
		if (platform) {
			const platformData = Platform.get(platform);
			if (!platformData) {
				throw new SupiError({
					message: "Invalid platform provided"
				});
			}

			channelsData = channelsData.filter(i => i.Platform === platformData);
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
		const row = await sb.Query.getRow("chat_data", "Channel");
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

		await channelData.setupLoggingTable();
		return channelData;
	}

	static async moveData (oldChannelData: Channel, newChannelData: Channel, options: MoveDataOptions = {}) {
		const properties = await sb.Query.getRecordset((rs: Recordset) => rs
			.select("Property", "Value")
			.from("chat_data", "Channel_Data")
			.where("Channel = %n", oldChannelData.ID)
		) as { Property: string; Value: GenericDataPropertyValue; }[];

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
			await sb.Query.getRecordDeleter((rd: RecordDeleter) => rd
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

		const data = await sb.Query.getRecordset((rs: Recordset) => rs
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
