import { randomBytes } from "node:crypto";
import {
	BaseMessageOptions,
	Channel as DiscordChannel,
	ChannelType,
	Client,
	DiscordAPIError,
	Emoji as DiscordEmoji,
	GatewayIntentBits,
	Guild, GuildMember,
	Message as DiscordMessage,
	Partials,
	PermissionFlagsBits,
	Routes,
	TextChannel,
	User as DiscordUser
} from "discord.js";

import { BaseConfig, Platform, PlatformVerificationStatus, PrepareMessageOptions } from "./template.js";
import type { Emote } from "../@types/globals.d.ts";
import User from "../classes/user.js";
import { SupiError } from "supi-core";
import Channel from "../classes/channel.js";

export type Embeds = BaseMessageOptions["embeds"];
type SimpleMessage = {
	msg: string;
	user: string;
	chan: string;
	channelType: ChannelType;
	discordID: string;
	author: DiscordUser;
	mentions: DiscordMessage["mentions"];
	guild: Guild | null;
	privateMessage: boolean;
	commandArguments: string[];
};
type HandleCommandData = {
	command: string;
	args: string[];
	channelData: Channel | null;
	userData: User;
	messageObject: DiscordMessage;
	options: {
		mentions: SimpleMessage["mentions"];
		guild: SimpleMessage["guild"];
		privateMessage: SimpleMessage["privateMessage"];
		member: GuildMember | null;
	};
};
export type MessageData = Omit<HandleCommandData["options"], "privateMessage">;

const IGNORED_CHANNEL_TYPES = new Set([
	ChannelType.GuildAnnouncement,
	ChannelType.GuildCategory,
	ChannelType.GuildNews,
	ChannelType.GuildNewsThread,
	ChannelType.GuildPrivateThread,
	ChannelType.GuildPublicThread,
	ChannelType.PrivateThread,
	ChannelType.PublicThread
]);

const GLOBAL_EMOTE_ALLOWED_REGEX = /[A-Z]/;
const MARKDOWN_TESTS = {
	ANY: /(?<!\S)(\*{1,3}|~~|`|_|__)(.+?)(\1)(?!\S)/g,
	SOL_NO_SPACE: /^(#{1,3}|>|>>>|```)/gm,
	SOL_SPACE: /^\s+([*-])\s+/gm
} as const;

const isTextChannel = (input: DiscordChannel): input is TextChannel => (input instanceof TextChannel);

const formatEmoji = (emote: Emote) => {
	const name = emote.name ?? "_";
	if (emote.animated) {
		return `<a:${name}:${emote.ID}>`;
	}
	else {
		return `<:${name}:${emote.ID}>`;
	}
};
const fixMarkdown = (text: string) => {
	let isMarkdown = false;
	for (const regex of Object.values(MARKDOWN_TESTS)) {
		isMarkdown ||= regex.test(text);
	}

	if (!isMarkdown) {
		return text;
	}
	else {
		const replaced = text.replaceAll("```", "`\u{200B}`\u{200B}`\u{200B}");
		return `\`\`\`${replaced}\`\`\``;
	}
};

interface DiscordConfig extends BaseConfig {
	selfId: string;
	platform: {
		sendVerificationChallenge?: boolean;
		guildCreateAnnounceChannel?: string | string[] | null;
	};
	logging: {
		messages?: boolean;
		whispers?: boolean;
	};
}

export class DiscordPlatform extends Platform<DiscordConfig> {
	#emoteFetchingPromise: Promise<Emote[]> | null = null;

	private readonly client: Client;

	constructor (config: DiscordConfig) {
		const resultConfig = { ...config };
		resultConfig.logging.messages ??= false;
		resultConfig.logging.whispers ??= true;

		resultConfig.platform.sendVerificationChallenge ??= false;
		resultConfig.platform.guildCreateAnnounceChannel ??= null;

		super("discord", resultConfig);

		this.client = new Client({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.GuildEmojisAndStickers,
				GatewayIntentBits.GuildMessageReactions,
				GatewayIntentBits.DirectMessages,
				GatewayIntentBits.DirectMessageReactions,
				GatewayIntentBits.MessageContent
			],
			partials: [
				Partials.Channel
			]
		});
	}

	async connect () {
		if (!this.selfId) {
			throw new SupiError({
				message: "Discord user ID (selfId) has not been configured"
			});
		}
		else if (!process.env.DISCORD_BOT_TOKEN) {
			throw new SupiError({
				message: "No Discord token configured (DISCORD_BOT_TOKEN)"
			});
		}

		this.initListeners();
		await this.client.login(process.env.DISCORD_BOT_TOKEN);
	}

	initListeners () {
		const client = this.client;

		client.on("messageCreate", (messageObject) => this.handleMessage(messageObject));

		client.on("guildCreate", async (guild) => {
			const message = `Joined guild ${guild.name}  - ID ${guild.id} - ${guild.memberCount} members`;
			await sb.Logger.log("Discord.Join", message);

			const announce = this.config.guildCreateAnnounceChannel;
			if (announce) {
				const channelList = (Array.isArray(announce))
					? announce
					: [announce];

				for (const channelID of channelList) {
					const channelData = sb.Channel.get(channelID, this);
					if (channelData) {
						await channelData.send(message);
					}
					else {
						console.warn(`No channel found for guild create announcement: ${channelID}`);
					}
				}
			}
		});

		// When a guild gets deleted, set all of its channels to be Inactive.
		client.on("guildDelete", async (guild) => {
			const platformMap = sb.Channel.data.get(this);
			for (const channelData of platformMap!.values()) {
				if (channelData.Specific_ID !== guild.id) {
					continue;
				}
				else if (channelData.Mode === "Inactive") {
					continue;
				}

				await channelData.saveProperty("Mode", "Inactive");
			}
		});

		// Set a channel to be Inactive in case it gets deleted.
		client.on("channelDelete", async (channel) => {
			const channelData = sb.Channel.get(channel.id);
			if (channelData && channelData.Mode !== "Inactive") {
				await channelData.saveProperty("Mode", "Inactive");
			}
		});

		client.on("error", async (err) => {
			// Don't restart on errors stemming from sending messages (usually caused by Discord API being momentarily down)
			if (err.toString().includes("TextChannel.send")) {
				return;
			}

			await sb.Logger.log("Discord.Error", err.toString(), null, null);
		});
	}

	async send (message: string | null, channelData: Channel, options: { keepWhitespace?: boolean; embeds?: Embeds; } = {}) {
		const channelObject = await this.client.channels.fetch(channelData.Name);
		if (!channelObject || !isTextChannel(channelObject)) {
			return;
		}

		if (message && channelObject.guild) {
			const emojiNameRegex = /^[\w\d]+$/;
			const words = message
				.split(/\s+/)
				.filter(Boolean)
				.filter(i => i.length > 2 && emojiNameRegex.test(i));

			const wordSet = new Set(words);
			const globalEmotes = await this.fetchGlobalEmotes();
			const skipGlobalEmotes = Boolean(await channelData.getDataProperty("disableDiscordGlobalEmotes"));

			for (const word of wordSet) {
				const eligibleEmotes = globalEmotes.filter(i => i.name === word);
				if (eligibleEmotes.length === 0) {
					continue;
				}

				let emote: Emote;
				const eligibleGuildEmotes = eligibleEmotes.filter(i => i.guild === channelObject.guild.id);
				if (eligibleGuildEmotes.length !== 0) {
					emote = eligibleGuildEmotes[0];
				}
				else if (!skipGlobalEmotes && GLOBAL_EMOTE_ALLOWED_REGEX.test(word) && word.length > 2) {
					emote = sb.Utils.randArray(eligibleEmotes);
				}
				else {
					continue;
				}

				// This regex makes sure all emotes to be replaces are not preceded or followed by a ":" (colon) character
				// All emotes on Discord are wrapped at least by colons
				const regex = new RegExp(`(?<!(:))\\b${emote.name}\\b(?!(:))`, "g");
				message = message.replace(regex, formatEmoji(emote));
			}
		}

		let sendTarget: string | { embeds: Embeds; };
		if (Array.isArray(options.embeds) && options.embeds.length !== 0) {
			sendTarget = {
				embeds: options.embeds
			};
		}
		else if (typeof message === "string") {
			const limit = channelData.Message_Limit ?? this.messageLimit;
			sendTarget = sb.Utils.wrapString(message, limit, {
				keepWhitespace: true
			});
		}
		else {
			throw new SupiError({
				message: "Invalid Discord message provided",
				args: {
					message,
					type: typeof message,
					channelId: channelData.ID
				}
			});
		}

		const fixed = (typeof sendTarget === "string") ? fixMarkdown(sendTarget) : sendTarget;
		try {
			await channelObject.send(fixed);
			this.incrementMessageMetric("sent", channelData);
		}
		catch (e) {
			if (e instanceof DiscordAPIError) {
				await sb.Logger.logError("Backend", e, {
					origin: "External",
					context: {
						message,
						hasEmbeds: Boolean(options?.embeds),
						channelID: channelObject.id,
						channelName: channelObject.name ?? null,
						guildID: channelObject.guild?.id ?? null,
						guildName: channelObject.guild?.name ?? null
					}
				});
			}
			else {
				const cause = (e instanceof Error) ? e : new Error(String(e));
				throw new SupiError({
					message: "Sending Discord channel message failed",
					args: {
						message,
						hasEmbeds: Boolean(options?.embeds),
						channelID: channelObject.id,
						channelName: channelObject.name ?? null,
						guildID: channelObject.guild?.id ?? null,
						guildName: channelObject.guild?.name ?? null
					},
					cause
				});
			}
		}
	}

	/**
	 * Sends a private message.
	 * The user in question must have their Discord ID filled out, otherwise the method fails.
	 */
	async pm (message: string | null, userData: User, options: { embeds?: Embeds; } = {}) {
		if (!userData.Discord_ID) {
			throw new SupiError({
				message: `Cannot send private message: user has no Discord ID`,
				args: {
					message,
					userID: userData.ID,
					userName: userData.Name
				}
			});
		}

		let discordUser: DiscordUser;
		try {
			discordUser = await this.client.users.fetch(userData.Discord_ID);
		}
		catch (e) {
			const cause = (e instanceof Error) ? e : new Error(String(e));
			throw new SupiError({
				message: "Cannot send private message: Discord user does not exist",
				args: {
					message,
					discordUserID: userData.Discord_ID,
					userID: userData.ID,
					userName: userData.Name
				},
				cause
			});
		}

		try {
			if (typeof message === "string") {
				const fixed = fixMarkdown(message);
				await discordUser.send(fixed);
			}
			else if (options.embeds && options.embeds.length !== 0) {
				await discordUser.send({
					embeds: options.embeds
				});
			}

			this.incrementMessageMetric("sent", null);
		}
		catch (e) {
			const cause = (e instanceof Error) ? e : new Error(String(e));
			throw new SupiError({
				message: "Sending Discord private message failed",
				args: {
					message,
					userName: userData.Name,
					userID: userData.ID,
					discordUserID: userData.Discord_ID
				},
				cause
			});
		}
	}

	/**
	 * Directly sends a private message to user, without them necessarily being saved as a user.
	 */
	async directPm (userID: string, message: string) {
		let discordUser;
		try {
			discordUser = await this.client.users.fetch(userID);
		}
		catch (e) {
			const cause = (e instanceof Error) ? e : new Error(String(e));
			throw new SupiError({
				message: "Cannot send direct private message: Discord user does not exist",
				args: { message, userID },
				cause
			});
		}

		try {
			const fixed = fixMarkdown(message);
			await discordUser.send(fixed);
			this.incrementMessageMetric("sent", null);
		}
		catch (e) {
			const cause = (e instanceof Error) ? e : new Error(String(e));
			throw new SupiError({
				message: "Sending direct Discord private message failed",
				args: {
					message,
					discordUserName: discordUser.username,
					discordUserID: userID
				},
				cause
			});
		}
	}

	async handleMessage (messageObject: DiscordMessage) {
		// Ignore all empty messages containing embeds.
		// User-embed media are included as message content, and direct uploads are included as attachments.
		// The only embeds sent like this are (usually) from bots, and can be ignored.
		if (messageObject.content.length === 0 && Array.isArray(messageObject.embeds) && messageObject.embeds.length > 0) {
			return;
		}

		const {
			commandArguments,
			chan,
			channelType,
			discordID,
			guild,
			msg,
			mentions,
			privateMessage,
			user
		} = this.parseMessage(messageObject);

		// Ignore all configured channel types - mostly threads and other non-discussion channels
		if (IGNORED_CHANNEL_TYPES.has(channelType)) {
			return;
		}

		// If the bot does not have SEND_MESSAGES permission in the channel, completely ignore the message.
		// Do not process it for logging, commands, AFKs, Reminders, anything.
		if (isTextChannel(messageObject.channel)) {
			const selfPermissions = messageObject.channel.permissionsFor(this.selfId);
			if (selfPermissions && !selfPermissions.has(PermissionFlagsBits.SendMessages)) {
				return;
			}
		}

		const usernameCharacterLength = [...user].length;
		if (usernameCharacterLength > 32) {
			const json = JSON.stringify({
				chan,
				discordID,
				guildName: guild?.name ?? null,
				guildMembers: guild?.memberCount ?? null,
				msg,
				user,
				userLength: user.length
			});

			await sb.Logger.log("Discord.Warning", `Discord username length > 32 characters: ${json}`);
			return;
		}

		let channelData = null;
		const userData = await sb.User.get(user, false, { Discord_ID: discordID });
		if (userData) {
			if (userData.Discord_ID === null && userData.Twitch_ID !== null) {
				if (!this.config.sendVerificationChallenge) {
					// No verification challenge - just assume it's correct
					await userData.saveProperty("Discord_ID", discordID);
				}
				else {
					if (!msg.startsWith(sb.Command.prefix)) {
						return;
					}

					const status = await DiscordPlatform.fetchAccountChallengeStatus(userData, discordID);
					if (status === "Active") {
						return;
					}

					const { challenge } = await DiscordPlatform.createAccountChallenge(userData, discordID);
					const message = sb.Utils.tag.trim `
						You were found to be likely to own a Twitch account with the same name as your current Discord account.
						If you want to use my commands on Discord, whisper me the following command on Twitch:
						${sb.Command.prefix}link ${challenge}
					 `;

					try {
						await this.directPm(discordID, message);
					}
					catch (e) {
						if (e instanceof Error && e.cause instanceof Error && e.cause.message !== "Cannot send messages to this user") {
							throw e;
						}

						const channelData = sb.Channel.get(chan);
						if (channelData) {
							await this.send(`@${userData.Name}, ${message}`, channelData);
						}
					}

					return;
				}
			}
			else if (userData.Discord_ID === null && userData.Twitch_ID === null) {
				await userData.saveProperty("Discord_ID", discordID);
			}
			else if (userData.Discord_ID !== discordID) {
				// Mismatch between discordID and userData.Discord_ID means someone renamed into a different
				// user's username, or that there is a different mishap happening. This case is unfortunately exceptional
				// for the current user-database structure and the event handler must be aborted.
				return;
			}
		}
		else {
			// No user data available at this point usually means that the object is being fetched from cache.
			// Still, fire a "raw user" message event
			const channelData = sb.Channel.get(chan, this);
			if (channelData) {
				channelData.events.emit("message", {
					event: "message",
					message: msg,
					user: null,
					channel: channelData,
					platform: this,
					raw: { user }
				});
			}

			return;
		}

		// @todo improve typings by removing some stuff from DiscordPlatform.parseMessage and introduce types
		if (!privateMessage && guild && isTextChannel(messageObject.channel)) {
			channelData = sb.Channel.get(chan, this);
			if (!channelData) {
				channelData = await sb.Channel.add(chan, this, "Write", guild.id);
			}

			// If a message comes from a channel set as "Inactive", this means it is active again.
			// Change its mode back to active.
			if (channelData.Mode === "Inactive") {
				await channelData.saveProperty("Mode", "Write");
			}

			if (!messageObject.channel) {
				await sb.Logger.log("Discord.Warning", JSON.stringify(messageObject), channelData);
			}

			const discordChannel = messageObject.channel;
			const guildName = guild.name;
			const discordChannelName = discordChannel.name;

			const channelDescription = `${guildName} - #${discordChannelName}`;
			if (channelData.Description !== channelDescription) {
				await channelData.saveProperty("Description", channelDescription);
			}

			if (channelData.NSFW !== discordChannel.nsfw) {
				await channelData.saveProperty("NSFW", discordChannel.nsfw);
			}

			this.resolveUserMessage(channelData, userData, msg);

			if (channelData.Logging.has("Meta")) {
				if (!msg) {
					const obj = {
						channel: channelData.Name,
						guild: guild.id,
						messageObject
					};

					await sb.Logger.log(
						"Discord.Warning",
						`No message text on Discord: ${JSON.stringify(obj)}`,
						channelData,
						userData
					);
				}
				else {
					await sb.Logger.updateLastSeen({ channelData, userData, message: msg });
				}
			}
			if (this.logging.messages && channelData.Logging.has("Lines")) {
				await sb.Logger.push(sb.Utils.wrapString(msg, this.messageLimit), userData, channelData);
			}

			channelData.events.emit("message", {
				type: "message",
				message: msg,
				user: userData,
				channel: channelData,
				platform: this
			});

			if (channelData.Mode === "Read") {
				return;
			}

			await Promise.all([
				sb.AwayFromKeyboard.checkActive(userData, channelData),
				sb.Reminder.checkActive(userData, channelData)
			]);

			// Mirroring is set up - mirror the message to the target channel
			if (channelData.Mirror) {
				await this.mirror(msg, userData, channelData, { commandUsed: false });
			}
		}
		else {
			if (this.logging.whispers) {
				await sb.Logger.push(msg, userData, null, this);
			}

			this.resolveUserMessage(null, userData, msg);
		}

		this.incrementMessageMetric("read", channelData);

		if (channelData && channelData.Mode === "Read") {
			return;
		}

		// Own message - skip
		if (discordID === this.selfId) {
			return;
		}

		// Starts with correct prefix - handle command
		if (sb.Command.is(msg)) {
			const commandPrefix = sb.Command.prefix;
			const command = msg.replace(commandPrefix, "").split(" ").find(Boolean) as string;
			const args = (commandArguments[0] === commandPrefix)
				? commandArguments.slice(2)
				: commandArguments.slice(1);

			if (messageObject.reference) {
				const { channelId, messageId } = messageObject.reference;
				const referenceChannel = await this.client.channels.fetch(channelId);
				if (referenceChannel && messageId && isTextChannel(referenceChannel)) {
					const referenceMessageObject = await referenceChannel.messages.fetch(messageId);

					const { msg } = this.parseMessage(referenceMessageObject);
					args.push(...msg.split(" ").filter(Boolean));
				}
			}

			await this.handleCommand({
				command,
				args: args.map(i => DiscordPlatform.removeEmoteTags(i)),
				channelData,
				userData,
				messageObject,
				options: {
					mentions,
					guild,
					privateMessage,
					member: messageObject.member
				}
			});
		}
	}

	async handleCommand (data: HandleCommandData) {
		const {
			command,
			args,
			channelData,
			userData,
			messageObject,
			options
		} = data;

		const { member, guild, mentions } = options;
		const execution = await sb.Command.checkAndExecute(
			command,
			args,
			channelData,
			userData,
			{ platform: this },
			{ member, guild, mentions }
		);

		if (!execution) {
			return;
		}

		const reactions = execution.discord?.reactions ?? [];
		if (reactions.length !== 0) {
			for (const reaction of reactions) {
				if (typeof reaction === "string") {
					await messageObject.react(reaction);
				}
				else if (reaction.emoji) {
					await messageObject.react(reaction.emoji);
				}
			}
		}

		const { reply } = execution;
		const embeds = execution.discord?.embeds ?? [];
		if (!reply && embeds.length === 0) {
			return;
		}

		const commandOptions = sb.Command.extractMetaResultProperties(execution);
		if (options.privateMessage || execution.replyWithPrivateMessage) {
			const message = (reply)
				? await this.prepareMessage(reply, null, commandOptions)
				: null;

			if (message === false) {
				return;
			}

			await this.pm(message, userData, { embeds });
			return;
		}

		if (!channelData) {
			throw new SupiError({
				message: "Assert error: No channel outside of Discord PM"
			});
		}

		if (embeds.length !== 0) {
			await this.send(null, channelData, {
				keepWhitespace: Boolean(commandOptions.keepWhitespace),
				embeds
			});
		}
		else {
			if (typeof reply !== "string") {
				throw new SupiError(({
					message: "Assert error: Discord reply is not string",
					args: { type: typeof reply }
				}))
			}

			if (channelData?.Mirror) {
				await this.mirror(reply, userData, channelData, {
					...commandOptions,
					commandUsed: true
				});
			}

			const message = await this.prepareMessage(reply, channelData, {
				...commandOptions,
				skipBanphrases: true
			});

			if (typeof message === "string") {
				await this.send(message, channelData, {
					keepWhitespace: Boolean(commandOptions.keepWhitespace)
				});
			}
		}
	}

	async prepareMessage (message: string, channelData: Channel | null, options: PrepareMessageOptions) {
		// wrapping a link in angle brackets removes its embedding from the Discord message
		if (options.removeEmbeds === true) {
			message = sb.Utils.replaceLinks(message, "<$1>");
		}

		return await super.prepareMessage(message, channelData, options);
	}

	destroy () {
		void this.client.destroy();
	}

	parseMessage (messageObject: DiscordMessage): SimpleMessage {
		const stickers = messageObject.stickers.map(i => i.url ?? i.name);
		const links = messageObject.attachments.map(i => i.proxyURL);
		const content = messageObject.content.replaceAll(/<(https?:\/\/.+?)>/g, "$1"); // Replaces all "un-embed" links' brackets
		const args: string[] = [
			...content.split(" "),
			...stickers,
			...links
		];

		for (let i = 0; i < args.length; i++) {
			const match = args[i].match(/<@!?(\d+)>/);
			if (match) {
				const user = messageObject.mentions.users.get(match[1]);
				if (user) {
					args[i] = `@${sb.User.normalizeUsername(user.username)}`;
				}
			}
		}

		let index = 0;
		let targetMessage = messageObject.cleanContent.replaceAll("\n", " ");

		const extras = [...stickers, ...links];
		while (targetMessage.length < this.messageLimit && index < extras.length) {
			targetMessage += ` ${extras[index]}`;
			index++;
		}

		const guild = (isTextChannel(messageObject.channel))
			? messageObject.channel.guild
			: null;

		return {
			msg: DiscordPlatform.removeEmoteTags(targetMessage.replaceAll(/\s+/g, " ")),
			user: messageObject.author.username.toLowerCase().replaceAll(/\s/g, "_"),
			chan: messageObject.channel.id,
			channelType: messageObject.channel.type,
			discordID: String(messageObject.author.id),
			author: messageObject.author,
			mentions: messageObject.mentions,
			guild,
			privateMessage: (messageObject.channel.type === ChannelType.DM),
			commandArguments: args
		};
	}

	async isUserChannelOwner (channelData: Channel, userData: User) {
		const channel = await this.client.channels.fetch(channelData.Name);
		if (!channel || !isTextChannel(channel) || !userData.Discord_ID) {
			return false;
		}

		const roles = await channel.guild.roles.fetch();
		const ambassadorRole = roles.find(i => i.name.toLowerCase() === "supibot ambassador");
		if (ambassadorRole) {
			const member = await channel.guild.members.fetch(userData.Discord_ID);
			if (member.roles.cache.has(ambassadorRole.id)) {
				return true;
			}
		}

		const permissions = channel.permissionsFor(userData.Discord_ID);
		if (!permissions) {
			return false;
		}

		return (
			permissions.has(PermissionFlagsBits.ManageChannels)
			|| permissions.has(PermissionFlagsBits.ManageGuild)
			|| permissions.has(PermissionFlagsBits.Administrator)
		);
	}

	async populateUserList (channelData: Channel) {
		const discordChannel = await this.client.channels.fetch(channelData.Name);
		if (!discordChannel) {
			throw new SupiError({
				message: "Discord channel is not available",
				args: { channel: channelData.Name }
			});
		}
		else if (!isTextChannel(discordChannel)) {
			return [];
		}

		const guild = await discordChannel.guild.fetch();
		await Promise.all([
			guild.members.fetch(),
			guild.roles.fetch()
		]);

		const list: string[] = [];
		for (const member of discordChannel.members.values()) {
			list.push(member.user.username);
		}

		return list;
	}

	async fetchChannelEmotes () { return []; }

	async populateGlobalEmotes () {
		if (this.#emoteFetchingPromise) {
			return this.#emoteFetchingPromise;
		}

		this.#emoteFetchingPromise = (async (): Promise<Emote[]> => {
			const result = [];
			const guilds = await this.client.guilds.fetch();

			for (const guildId of guilds.keys()) {
				const response = await this.client.rest.get(Routes.guildEmojis(guildId)) as DiscordEmoji[];
				for (const emote of response) {
					if (!emote.name || !emote.id) {
						continue;
					}

					result.push({
						type: "discord" as const,
						ID: emote.id,
						name: emote.name,
						guild: guildId,
						global: true,
						animated: (emote.animated)
					});
				}
			}

			this.#emoteFetchingPromise = null;
			return result;
		})()

		return await this.#emoteFetchingPromise;
	}

	fetchInternalPlatformIDByUsername (userData: User) {
		return userData.Discord_ID;
	}

	async fetchUsernameByUserPlatformID (userPlatformID: string) {
		let response;
		try {
			response = await this.client.users.fetch(userPlatformID);
		}
		catch {
			return null;
		}

		return response.username;
	}

	async createUserMention (userData: User, channelData: Channel) {
		if (!userData.Discord_ID || !channelData || !channelData.Specific_ID) {
			return userData.Name;
		}

		const guild = await this.client.guilds.fetch(channelData.Specific_ID);
		const guildMember = guild.members.resolve(userData.Discord_ID);

		return (guildMember !== null)
			? `<@${userData.Discord_ID}>`
			: userData.Name;
	}

	isChannelLive () { return null; }

	get permissions () { return PermissionFlagsBits; }

	static removeEmoteTags (message: string) {
		return message.replaceAll(/<a?:(.*?):(\d*)>/g, (_total, emote) => `${emote} `).trim();
	}

	static async fetchAccountChallengeStatus (userData: User, discordID: string) {
		return await sb.Query.getRecordset<PlatformVerificationStatus>(rs => rs
			.select("Status")
			.from("chat_data", "User_Verification_Challenge")
			.where("User_Alias = %n", userData.ID)
			.where("Specific_ID = %s", discordID)
			.orderBy("ID DESC")
			.limit(1)
			.single()
			.flat("Status")
		);
	}

	static async createAccountChallenge (userData: User, discordID: string) {
		const row = await sb.Query.getRow("chat_data", "User_Verification_Challenge");
		const challenge = randomBytes(16).toString("hex");

		const discordPlatform = Platform.get("discord");
		const twitchPlatform = Platform.get("twitch");
		if (!discordPlatform || !twitchPlatform) {
			throw new SupiError({
				message: "Missing platform(s) to create a verification challenge"
			});
		}

		row.setValues({
			User_Alias: userData.ID,
			Specific_ID: discordID,
			Challenge: challenge,
			Platform_From: discordPlatform.ID,
			Platform_To: twitchPlatform.ID
		});

		await row.save();
		return {
			challenge
		};
	}
}

export default DiscordPlatform;
