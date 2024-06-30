const {
	ChannelType,
	Client,
	DiscordAPIError,
	GuildMember,
	GatewayIntentBits,
	Partials,
	PermissionFlagsBits,
	Routes
} = require("discord.js");

const ignoredChannelTypes = [
	ChannelType.GuildAnnouncement,
	ChannelType.GuildCategory,
	ChannelType.GuildNews,
	ChannelType.GuildNewsThread,
	ChannelType.GuildPrivateThread,
	ChannelType.GuildPublicThread,
	ChannelType.PrivateThread,
	ChannelType.PublicThread
];

const GLOBAL_EMOTE_ALLOWED_REGEX = /[A-Z]/;
const DEFAULT_LOGGING_CONFIG = {
	messages: true,
	whispers: true
};
const DEFAULT_PLATFORM_CONFIG = {
	sendVerificationChallenge: false,
	createReminderWhenSendingPrivateMessageFails: true
};
const MARKDOWN_TESTS = {
	ANY: /(\*{1,3}|~~|`|_|__)(.+?)(\1)/g,
	SOL_NO_SPACE: /^(#{1,3}|>|>>>|```)/gm,
	SOL_SPACE: /^\s+([*-])\s+/gm
};

const formatEmoji = (emote) => `<:_:${emote.ID}>`;
const fixMarkdown = (text) => {
	let isMarkdown = false;
	for (const regex of Object.values(MARKDOWN_TESTS)) {
		isMarkdown ||= regex.test(text);
	}

	if (!isMarkdown) {
		return text;
	}
	else {
		const replaced = text.replace(/```/g, "`\u{200B}`\u{200B}`\u{200B}");
		return `\`\`\`${replaced}\`\`\``;
	}
};

module.exports = class DiscordPlatform extends require("./template.js") {
	#emoteFetchingPromise = null;

	constructor (config) {
		super("discord", config, {
			logging: DEFAULT_LOGGING_CONFIG,
			platform: DEFAULT_PLATFORM_CONFIG
		});

		if (!this.selfId) {
			throw new sb.Error({
				message: "Discord user ID (selfId) has not been configured"
			});
		}
		else if (!sb.Config.has("DISCORD_BOT_TOKEN", true)) {
			throw new sb.Error({
				message: "Discord bot token has not been configured"
			});
		}
	}

	async connect () {
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

		this.initListeners();

		const token = sb.Config.get("DISCORD_BOT_TOKEN");
		await this.client.login(token);
	}

	initListeners () {
		const client = this.client;

		client.on("messageCreate", async (messageObject) => {
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
			if (ignoredChannelTypes.includes(channelType)) {
				return;
			}

			// If the bot does not have SEND_MESSAGES permission in the channel, completely ignore the message.
			// Do not process it for logging, commands, AFKs, Reminders, anything.
			const selfPermissions = messageObject.channel.permissionsFor?.(this.selfId);
			if (selfPermissions && !selfPermissions.has(PermissionFlagsBits.SendMessages)) {
				return;
			}

			if (Array.from(user).length > 32) {
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
							if (e.cause?.message !== "Cannot send messages to this user") {
								throw e;
							}

							await this.send(`@${userData.Name}, ${message}`, chan);
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

			if (!privateMessage) {
				channelData = sb.Channel.get(chan, this);
				if (!channelData) {
					channelData = await sb.Channel.add(chan, this);
				}
				if (guild && guild.id && channelData.Specific_ID !== guild.id) {
					await channelData.saveProperty("Specific_ID", guild.id);
				}

				// If a message comes from a channel set as "Inactive", this means it is active again.
				// Change its mode back to active.
				if (channelData.Mode === "Inactive") {
					channelData.Mode = "Write";
					await channelData.saveProperty("Mode", channelData.Mode);
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
				const command = msg.replace(commandPrefix, "").split(" ").find(Boolean);
				const args = (commandArguments[0] === commandPrefix)
					? commandArguments.slice(2)
					: commandArguments.slice(1);

				if (messageObject.reference) {
					const { channelId, messageId } = messageObject.reference;
					const referenceChannel = await this.client.channels.fetch(channelId);
					const referenceMessageObject = await referenceChannel.messages.fetch(messageId);
					const { msg } = this.parseMessage(referenceMessageObject);

					args.push(...msg.split(" ").filter(Boolean));
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
		});

		client.on("guildCreate", async (guild) => {
			const message = `Joined guild ${guild.name}  - ID ${guild.id} - ${guild.memberCount} members`;
			await sb.Logger.log(
				"Discord.Join",
				message
			);

			const announce = sb.Config.get("DISCORD_GUILD_JOIN_ANNOUNCE_CHANNEL", false);
			if (announce) {
				const channelList = (Array.isArray(announce))
					? announce
					: [announce];

				for (const channelID of channelList) {
					const channelData = sb.Channel.get(channelID);
					await channelData.send(message);
				}
			}
		});

		// When a guild gets deleted, set all of its channels to be Inactive.
		client.on("guildDelete", async (guild) => {
			const platformMap = sb.Channel.data.get(this);
			for (const channelData of platformMap.values()) {
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
			// this.restart();
		});
	}

	/**
	 * Sends a message
	 * @param message
	 * @param channel
	 * @param {Object} options
	 */
	async send (message, channel, options = {}) {
		// const globalEmoteRegex = /[A-Z]/;
		const channelData = sb.Channel.get(channel, this);
		const channelObject = await this.client.channels.fetch(channelData.Name);
		if (!channelObject) {
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

				let emote;
				const eligibleGuildEmotes = eligibleEmotes.filter(i => i.guild === channelObject.guild.id);
				if (eligibleGuildEmotes.length !== 0) {
					emote = eligibleGuildEmotes[0];
				}
				else if (!skipGlobalEmotes && GLOBAL_EMOTE_ALLOWED_REGEX.test(word) && word.length > 2) {
					emote = sb.Utils.randArray(eligibleEmotes);
				}

				// This regex makes sure all emotes to be replaces are not preceded or followed by a ":" (colon) character
				// All emotes on Discord are wrapped at least by colons
				const regex = new RegExp(`(?<!(:))\\b${emote.name}\\b(?!(:))`, "g");
				message = message.replace(regex, formatEmoji(emote));
			}
		}

		let sendTarget;
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
			throw new sb.Error({
				message: "Invalid Discord message provided",
				args: {
					message,
					type: typeof message,
					channel,
					options
				}
			});
		}

		try {
			const fixed = fixMarkdown(sendTarget);
			await channelObject.send(fixed);
			this.incrementMessageMetric("sent", channelData);
		}
		catch (e) {
			if (e instanceof DiscordAPIError) {
				await sb.Logger.logError("Backend", e, {
					origin: "External",
					context: {
						message: sendTarget,
						channelID: channelObject.id,
						channelName: channelObject.name ?? null,
						guildID: channelObject.guild?.id ?? null,
						guildName: channelObject.guild?.name ?? null
					}
				});
			}
			else {
				throw new sb.Error({
					message: "Sending Discord channel message failed",
					args: {
						message: sendTarget,
						channelID: channelObject.id,
						channelName: channelObject.name ?? null,
						guildID: channelObject.guild?.id ?? null,
						guildName: channelObject.guild?.name ?? null
					},
					cause: e
				});
			}
		}
	}

	me () {
		throw new sb.Error({
			message: "Cannot use the /me action on Discord"
		});
	}

	/**
	 * Sends a private message.
	 * The user in question must have their Discord ID filled out, otherwise the method fails.
	 * @param {string} message
	 * @param {User|string|number} user
	 * @param {Object} options
	 * @param {Object[]} [options.embeds]
	 * @returns {Promise<void>}
	 * @throws {sb.Error} If the provided user does not exist
	 * @throws {sb.Error} If the provided user has no Discord ID connected.
	 */
	async pm (message, user, options = {}) {
		const userData = await sb.User.get(user, true);
		if (!userData) {
			throw new sb.Error({
				message: `Cannot private message: user does not exist`,
				args: {
					user: String(user),
					message
				}
			});
		}
		else if (!userData.Discord_ID) {
			throw new sb.Error({
				message: `Cannot send private message: user has no Discord ID`,
				args: {
					message,
					userID: userData.ID,
					userName: userData.Name
				}
			});
		}

		let discordUser;
		try {
			discordUser = await this.client.users.fetch(userData.Discord_ID);
		}
		catch (e) {
			throw new sb.Error({
				message: "Cannot send private message: Discord user does not exist",
				args: {
					message,
					discordUserID: userData.Discord_ID,
					userID: userData.ID,
					userName: userData.Name
				},
				cause: e
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
			if (!this.config.createReminderWhenSendingPrivateMessageFails) {
				throw new sb.Error({
					message: "Sending Discord private message failed",
					args: {
						message,
						userName: userData.Name,
						userID: userData.ID,
						discordUserID: userData.Discord_ID
					},
					cause: e
				});
			}

			const currentUTC = new sb.Date().setTimezoneOffset(0).format("Y-m-d H:i:s");
			const pasteMessage = `Private message from Supibot, posted on ${currentUTC} GMT\n\n${message}`;

			const result = await sb.Pastebin.post(pasteMessage, {
				name: "Supibot private message",
				privacy: "unlisted",
				expiration: "1D"
			});

			if (result.success) {
				const botData = await sb.User.get(this.selfName);
				await sb.Reminder.create({
					User_From: botData.ID,
					User_To: userData.ID,
					Channel: null,
					Platform: this.ID,
					Schedule: null,
					Created: new sb.Date(),
					Private_Message: false,
					Text: `I tried to send you a DM, but it didn't go through. Check it here: ${result.body}`
				}, true);
			}
		}
	}

	/**
	 * Directly sends a private message to user, without them necessarily being saved as a user.
	 * @param {string} userID
	 * @param {string} message
	 * @returns {Promise<void>}
	 */
	async directPm (userID, message) {
		let discordUser;
		try {
			discordUser = await this.client.users.fetch(userID);
		}
		catch (e) {
			throw new sb.Error({
				message: "Cannot send direct private message: Discord user does not exist",
				args: { message, userID },
				cause: e
			});
		}

		try {
			const fixed = fixMarkdown(message);
			await discordUser.send(fixed);
			this.incrementMessageMetric("sent", null);
		}
		catch (e) {
			throw new sb.Error({
				message: "Sending direct Discord private message failed",
				args: {
					message,
					discordUserName: discordUser.username,
					discordUserID: userID
				},
				cause: e
			});
		}
	}

	/**
	 * Handles command execution.
	 * @param {Object} data
	 * @param {string} data.command Command invocation string
	 * @param {string[]} data.args
	 * @param {User} data.userData
	 * @param {Channel} data.channelData
	 * @param {Object} data.options = {}
	 * @param {Object} data.options = {}
	 * @returns {Promise<void>}
	 */
	async handleCommand (data) {
		const {
			command,
			args,
			channelData,
			userData,
			options = {},
			messageObject
		} = data;

		const execution = await sb.Command.checkAndExecute(command, args, channelData, userData, {
			platform: this,
			...options
		});

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

			await this.pm(message, userData, { embeds });
		}
		else if (embeds.length !== 0) {
			if (channelData?.Mirror && reply) {
				await this.mirror(reply, userData, channelData, {
					...commandOptions,
					commandUsed: true
				});
			}

			await this.send(null, channelData, {
				keepWhitespace: Boolean(commandOptions.keepWhitespace),
				embeds
			});
		}
		else {
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

			await this.send(message, channelData, {
				keepWhitespace: Boolean(commandOptions.keepWhitespace)
			});
		}
	}

	/** @override */
	async prepareMessage (message, channelData, options) {
		// wrapping a link in angle brackets removes its embedding from the Discord message
		if (options.removeEmbeds === true) {
			message = sb.Utils.replaceLinks(message, "<$1>");
		}

		return await super.prepareMessage(message, channelData, options);
	}

	destroy () {
		this.client && this.client.destroy();
		this.client = null;
	}

	parseMessage (messageObject) {
		const stickers = messageObject.stickers.map(i => i.url ?? i.name);
		const links = messageObject.attachments.map(i => i.proxyURL);
		const content = messageObject.content.replace(/<(https?:\/\/.+?)>/g, "$1"); // Replaces all "un-embed" links' brackets
		const args = [
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
		let targetMessage = messageObject.cleanContent.replace(/\n/g, " ");

		const extras = [...stickers, ...links];
		while (targetMessage.length < this.messageLimit && index < extras.length) {
			targetMessage += ` ${extras[index]}`;
			index++;
		}

		return {
			msg: DiscordPlatform.removeEmoteTags(targetMessage.replace(/\s+/g, " ")),
			user: messageObject.author.username.toLowerCase().replace(/\s/g, "_"),
			chan: messageObject.channel.id,
			channelType: messageObject.channel.type,
			discordID: String(messageObject.author.id),
			author: messageObject.author,
			mentions: messageObject.mentions,
			guild: messageObject?.channel?.guild ?? null,
			privateMessage: (messageObject.channel.type === ChannelType.DM),
			commandArguments: args
		};
	}

	async isUserChannelOwner (channelData, userData) {
		if (userData === null || channelData === null) {
			return false;
		}

		const channel = await this.client.channels.fetch(channelData.Name);
		if (!channel || !channel.guild) {
			return false;
		}

		const permissions = channel.permissionsFor(userData.Discord_ID);
		return (
			permissions.has(PermissionFlagsBits.ManageChannels)
			|| permissions.has(PermissionFlagsBits.ManageGuild)
			|| permissions.has(PermissionFlagsBits.Administrator)
		);
	}

	async populateUserList (channelIdentifier) {
		const channel = await this.client.channels.fetch(channelIdentifier);
		const guild = await channel.guild.fetch();

		await Promise.all([
			guild.members.fetch(),
			guild.roles.fetch()
		]);

		return [...channel.members.values()].map(i => i.user.username);
	}

	async fetchChannelEmotes () { return []; }

	async populateGlobalEmotes () {
		if (this.#emoteFetchingPromise) {
			return await this.#emoteFetchingPromise;
		}

		this.#emoteFetchingPromise = (async () => {
			const result = [];
			const guilds = await this.client.guilds.fetch();

			for (const guildId of guilds.keys()) {
				const response = await this.client.rest.get(Routes.guildEmojis(guildId));
				for (const emote of response) {
					result.push({
						type: "discord",
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
		})();

		return await this.#emoteFetchingPromise;
	}

	fetchInternalPlatformIDByUsername (userData) {
		return userData.Discord_ID;
	}

	async fetchUsernameByUserPlatformID (userPlatformID) {
		let response;
		try {
			response = await this.client.users.fetch(userPlatformID);
		}
		catch {
			return null;
		}

		return response.username;
	}

	async createUserMention (userData, channelData) {
		if (!userData.Discord_ID || !channelData || !channelData.Specific_ID) {
			return userData.Name;
		}

		const guild = await this.client.guilds.fetch(channelData.Specific_ID);
		const guildMember = await guild.members.resolve(userData.Discord_ID);

		return (guildMember instanceof GuildMember)
			? `<@${userData.Discord_ID}>`
			: userData.Name;
	}

	get permissions () { return PermissionFlagsBits; }

	static removeEmoteTags (message) {
		return message.replace(/<a?:(.*?):(\d*)>/g, (total, emote) => `${emote} `).trim();
	}

	static async fetchAccountChallengeStatus (userData, discordID) {
		return await sb.Query.getRecordset(rs => rs
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

	static async createAccountChallenge (userData, discordID) {
		const row = await sb.Query.getRow("chat_data", "User_Verification_Challenge");
		const challenge = require("crypto").randomBytes(16).toString("hex");

		row.setValues({
			User_Alias: userData.ID,
			Specific_ID: discordID,
			Challenge: challenge,
			Platform_From: sb.Platform.get("discord").ID,
			Platform_To: sb.Platform.get("twitch").ID
		});

		await row.save();
		return {
			challenge
		};
	}
};
