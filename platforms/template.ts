import { SupiError, SupiPromise } from "supi-core";

import { User } from "../classes/user.js";
import { Channel, Emote, type Like as ChannelLike } from "../classes/channel.js";
import { Banphrase } from "../classes/banphrase.js";

import createMessageLoggingTable from "../utils/create-db-table.js";
const DEFAULT_MESSAGE_WAIT_TIMEOUT = 10_000;

type Like = Platform | number | string;

export type GenericDataConfiguration = Record<string, unknown>;
export type GenericLoggingConfiguration = Record<string, unknown>;

type PlatformConfiguration = Pick<
	Platform,
	"name" | "host" | "messageLimit" | "selfName" | "selfId" | "mirrorIdentifier" | "active"
> & {
	ID: Platform["ID"];
	platform: Platform["data"];
	logging: Platform["loggingConfig"];
};

type PrepareMessageOptions = {
	extraLength?: number;
	removeEmbeds?: boolean;
	skipLengthCheck?: boolean;
	keepWhitespace?: boolean;
	skipBanphrases?: boolean;
	returnBooleanOnFail?: boolean;
};
export type GetEmoteOptions = {
	shuffle?: boolean;
	caseSensitivity?: boolean;
	returnEmoteObject?: boolean;
	filter?: (emote: Emote) => boolean;
};

type MirrorOptions = PrepareMessageOptions & { commandUsed?: boolean; };

type MessageAwaiterResolution = { message: string; } | null;
type MessageAwaiterObject = {
	timeout: NodeJS.Timeout;
	promise: SupiPromise<MessageAwaiterResolution>;
}
type MessageAwaiterOptions = { timeout?: number; };

export type GenericSendOptions = Record<string, unknown>;

export abstract class Platform {
	readonly id: number;
	readonly name: string;
	readonly host: string | null;
	readonly messageLimit: number;
	readonly selfId: string | null;
	readonly selfName: string;
	readonly mirrorIdentifier: string | null;
	readonly data: GenericDataConfiguration;
	readonly loggingConfig: GenericLoggingConfiguration;
	readonly active: boolean;

	readonly globalEmoteCacheKey: string;
	readonly #userMessagePromises: Map<Channel["ID"], Map<User["ID"], MessageAwaiterObject>> = new Map();
	#privateMessagesTablePromise: Promise<{ success: boolean; }> | null = null;


	readonly supportsMeAction = false;
	readonly dynamicChannelAddition = false;

	static list: Platform[] = [];

	constructor (name: string, config: PlatformConfiguration, defaults = {}) {
		this.name = name;
		this.id = config.ID;

		if (!this.id) {
			throw new sb.Error({
				message: "Platform ID must be configured"
			});
		}
		else if (!Number.isInteger(this.id)) {
			throw new sb.Error({
				message: "Platform ID must be an integer"
			});
		}

		this.host = config.host ?? null;
		this.messageLimit = config.messageLimit ?? null;
		this.selfId = config.selfId ?? null;
		this.selfName = config.selfName?.toLowerCase() ?? null;
		this.mirrorIdentifier = config.mirrorIdentifier ?? null;

		this.data = {
			...defaults.platform,
			...config.platform
		};
		this.loggingConfig = {
			...defaults.logging,
			...config.logging
		};

		this.globalEmoteCacheKey = `global-emotes-${this.id}`;
		this.active = config.active ?? false;

		Platform.list.push(this);
	}

	checkConfig () {
		if (!this.selfName) {
			throw new sb.Error({
				message: "Invalid Platform property: selfName",
				args: { id: this.id, name: this.name, selfName: this.selfName }
			});
		}

		if (!Number.isInteger(this.messageLimit) || this.messageLimit <= 0) {
			throw new sb.Error({
				message: "Invalid Platform property: messageLimit",
				args: { id: this.id, name: this.name, messageLimit: this.messageLimit }
			});
		}
	}

	getFullName (separator: string = "-"): string {
		if (this.name === "irc") {
			return [this.name, this.host].filter(Boolean).join(separator);
		}
		else {
			return this.name;
		}
	}

	abstract initListeners (): void;
	abstract send (message: string, channel: Channel, options?: GenericSendOptions): Promise<void>;
	abstract pm (message: string, user: User, channel: Channel): Promise<void>;
	abstract isUserChannelOwner (channelData: Channel, userData: User): Promise<boolean | null>;
	abstract populateUserList (channelData: Channel): Promise<string[]>;
	abstract populateGlobalEmotes (): Promise<Emote[]>;
	abstract fetchChannelEmotes (channelData: Channel): Promise<Emote[]>;
	abstract createUserMention (userData: User, channelData?: Channel | null): Promise<string>;
	/**
	 * Fetches the platform ID for a given user object, depending on which platform instance is used.
	 * Does not use the platforms' API for fetching, simply uses the internal sb.User data - and hence should not
	 * be used long-term (more specifically, after the User_Alias refactor).
	 */
	abstract fetchInternalPlatformIDByUsername (userData: User): string | null;
	/**
	 * Fetches the username for a given user platform ID, depending on which platform instance is used.
	 */
	abstract fetchUsernameByUserPlatformID (userPlatformID: string): Promise<string | null>;
	/**
	 * Determines if a given channel within this platform is currently "live", as in livestreaming.
	 */
	abstract isChannelLive (channelData: Channel): Promise<boolean> | null;

	incrementMessageMetric (type: "read" | "sent", channelIdentifier: ChannelLike | null) {
		let channel = "(private)";
		if (channelIdentifier) {
			const channelData = Channel.get(channelIdentifier);
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

	/**
	 * For a given combination of channel and user, creates and returns a promise that will be resolved when the
	 * provided user sends a message in the provided channel. The promise will be rejected if the user does not post
	 * a message within a timeout specified in options.
	 *
	 * This is achieved by using a remotely-resolvable `SupiPromise`, which is returned from this method.
	 * Whenever the user sends a message the bot is supposed to react to, that SupiPromise will be resolved
	 * "externally" from the Platform instance - see the `resolveUserMessage` method.
	 */
	waitForUserMessage (channelData: Channel, userData: User, options: MessageAwaiterOptions = {}): SupiPromise<MessageAwaiterResolution> {
		const delay = options.timeout ?? DEFAULT_MESSAGE_WAIT_TIMEOUT;
		const promise = new SupiPromise<MessageAwaiterResolution | null>();

		let userMap = this.#userMessagePromises.get(channelData.ID);
		if (!userMap) {
			userMap = new Map();
			this.#userMessagePromises.set(channelData.ID, userMap);
		}

		if (userMap.has(userData.ID)) {
			throw new sb.Error({
				message: "User already has a pending promise in the provided channel!"
			});
		}

		const timeout = setTimeout(() => {
			promise.resolve(null);
			userMap.delete(userData.ID);
		}, delay);

		userMap.set(userData.ID, { promise, timeout });

		return promise;
	}

	/**
	 * Internally resolves a registered awaiting message.
	 * This is done by "remotely" resolving a referenced `SupiPromise` instance, which is created
	 * when calling the `waitForUserMessage` method.
	 */
	resolveUserMessage (channelData: Channel, userData: User, message: string): void {
		const userMap = this.#userMessagePromises.get(channelData.ID);
		if (!userMap) {
			return;
		}

		const awaiter = userMap.get(userData.ID);
		if (!awaiter) {
			return;
		}

		const { promise, timeout } = awaiter;
		clearTimeout(timeout);

		userMap.delete(userData.ID);
		promise.resolve({ message });
	}

	/**
	 * Mirrors a message from one channel to another
	 * Mirrored messages should not be prepared in the origin channel, they are checked against the target channel.
	 * Double-checking would lead to inconsistent behaviour.
	 * @param message
	 * @param userData
	 * @param channelData The channel where the message is coming from
	 * @param [options]
	 * @param [options.commandUsed] = false If a command was used, do not include the username of who issued the command.
	 */
	async mirror (message: string, userData: User | null, channelData: Channel, options: MirrorOptions = {}): Promise<void> {
		// Do not mirror at all if the Platform has no mirror identifier configured
		const symbol = this.mirrorIdentifier;
		if (symbol === null) {
			return;
		}
		if (!channelData.Mirror) {
			return;
		}

		const mirrorChannelData = Channel.get(channelData.Mirror);
		if (!mirrorChannelData) {
			throw new SupiError({
				message: "Provided channel has an invalid mirror-channel set up",
				args: { mirrorId: channelData.Mirror }
			});
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
			await mirrorChannelData.send(finalMessage);
		}
	}

	async fetchChannelUserList (channelData: Channel): Promise<string[]> {
		const key = this.#getChannelUserListKey(channelData);
		const cacheData = await sb.Cache.getByPrefix(key) as string[] | null;
		if (cacheData) {
			return cacheData;
		}

		const userList = await this.populateUserList(channelData);

		await sb.Cache.setByPrefix(key, userList, {
			expiry: 300_000 // 5 minutes
		});

		return userList;
	}

	async fetchGlobalEmotes (): Promise<Emote[]> {
		const key = this.globalEmoteCacheKey;
		const cacheData = await sb.Cache.getByPrefix(key) as Emote[] | null;
		if (cacheData) {
			return cacheData;
		}

		const data = await this.populateGlobalEmotes();
		await sb.Cache.setByPrefix(key, data, {
			expiry: 864e5 // 24 hours
		});

		return data;
	}

	async invalidateGlobalEmotesCache (): Promise<void> {
		const key = this.globalEmoteCacheKey;
		await sb.Cache.setByPrefix(key, null);
	}

	async getBestAvailableEmote (channelData: Channel, emotes: string[], fallbackEmote: string, options: GetEmoteOptions = {}) {
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
	 * Prepares a message to be sent in the provided channel. Checks banphrases, respects length limits.
	 * Ignores if channel is inactive or read-only.
	 * @param message
	 * @param channel
	 * @param options = {}
	 * @param [options.skipBanphrases] If true, no banphrases will be checked
	 * @param [options.skipLengthCheck] If true, length will not be checked
	 * @param [options.keepWhitespace] If true, whitespace will not be stripped
	 */
	async prepareMessage (message: string, channel: Channel | null, options: PrepareMessageOptions = {}): Promise<string | false> {
		let channelData: Channel | null = null;
		let limit = Infinity;

		if (channel !== null) {
			channelData = sb.Channel.get(channel);

			// Read-only/Inactive/Nonexistent - do not send anything
			if (!channelData || channelData.Mode === "Read" || channelData.Mode === "Inactive") {
				return false;
			}

			// Remove all links, if the channel requires it - replace all links with a placeholder
			if (!channelData.Links_Allowed) {
				message = sb.Utils.replaceLinks(message, "[LINK]");
			}

			if (!options.skipLengthCheck) {
				limit = channelData.Message_Limit ?? channelData.Platform.messageLimit;
			}
		}

		let resultMessage = sb.Utils.wrapString(message, limit, {
			keepWhitespace: Boolean(options.keepWhitespace)
		});

		// Execute all eligible banphrases, if necessary
		if (!options.skipBanphrases) {
			const { passed, string } = await Banphrase.execute(resultMessage, channelData);
			if (!passed && options.returnBooleanOnFail) {
				return passed;
			}

			resultMessage = string;
		}

		// If the result is not string, do not reply at all.
		if (typeof resultMessage !== "string") {
			return false;
		}

		return resultMessage;
	}

	#getChannelUserListKey (channelData: Channel) {
		return `channel-user-list-${this.id}-${channelData.ID}`;
	}

	setupLoggingTable (): Promise<{ success: boolean; }> {
		if (this.#privateMessagesTablePromise) {
			return this.#privateMessagesTablePromise;
		}

		const name = this.privateMessageLoggingTableName;
		this.#privateMessagesTablePromise = createMessageLoggingTable(name);
		return this.#privateMessagesTablePromise;
	}

	restart () {}

	destroy () {}

	get ID () { return this.id; }
	get Name () { return this.name; }
	get Host () { return this.host; }
	get Message_Limit () { return this.messageLimit; }
	get Self_Name () { return this.selfName; }
	get Self_ID () { return this.selfId; }
	get Mirror_Identifier () { return this.mirrorIdentifier; }
	get Data () { return this.data; }
	get config () { return this.data; }
	get Logging () { return this.loggingConfig; }
	get logging () { return this.loggingConfig; }

	get capital () { return sb.Utils.capitalize(this.name); }
	get userMessagePromises () { return this.#userMessagePromises; }
	get privateMessageLoggingTableName () {
		const name = this.getFullName("_");
		return `#${name}_private_messages`;
	}

	static get (identifier: Like, host?: string | null) {
		if (identifier instanceof Platform) {
			return identifier;
		}
		else if (typeof identifier === "number") {
			return Platform.list.find(i => i.ID === identifier) ?? null;
		}
		else {
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
			return new GenericPlatform(type, config);
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

class GenericPlatform extends Platform {
	initListeners (): void {}

	createUserMention (): never { throw new SupiError({ message: "Method unavailable in GenericPlatform" }); }
	fetchChannelEmotes (): never { throw new SupiError({ message: "Method unavailable in GenericPlatform" }); }
	fetchInternalPlatformIDByUsername (): never { throw new SupiError({ message: "Method unavailable in GenericPlatform" }); }
	fetchUsernameByUserPlatformID (): never { throw new SupiError({ message: "Method unavailable in GenericPlatform" }); }
	isChannelLive (): never { throw new SupiError({ message: "Method unavailable in GenericPlatform" }); }
	isUserChannelOwner (): never { throw new SupiError({ message: "Method unavailable in GenericPlatform" }); }
	pm (): never { throw new SupiError({ message: "Method unavailable in GenericPlatform" }); }
	send (): never { throw new SupiError({ message: "Method unavailable in GenericPlatform" }); }
	populateGlobalEmotes (): never { throw new SupiError({ message: "Method unavailable in GenericPlatform" }); }
	populateUserList (): never { throw new SupiError({ message: "Method unavailable in GenericPlatform" }); }
}

export default Platform;
