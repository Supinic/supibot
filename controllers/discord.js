const { Client, Intents, DiscordAPIError, GuildMember } = require("discord.js");

module.exports = class DiscordController extends require("./template.js") {
	constructor () {
		super();

		this.platform = sb.Platform.get("discord");
		if (!this.platform) {
			throw new sb.Error({
				message: "Discord platform has not been created"
			});
		}
		else if (!this.platform.Self_ID) {
			throw new sb.Error({
				message: "Discord user ID (Platform/Self_ID) has not been configured"
			});
		}
		else if (!sb.Config.has("DISCORD_BOT_TOKEN", true)) {
			throw new sb.Error({
				message: "Discord bot token has not been configured"
			});
		}

		const intents = new Intents();
		intents.add(
			"GUILDS",
			"GUILD_MEMBERS",
			"GUILD_EMOJIS_AND_STICKERS",
			"GUILD_MESSAGES",
			"GUILD_MESSAGE_REACTIONS",
			"DIRECT_MESSAGES",
			"DIRECT_MESSAGE_REACTIONS"
		);

		this.client = new Client({
			intents,
			partials: ["CHANNEL"]
		});

		this.initListeners();

		/** @type {string|undefined} */
		const token = sb.Config.get("DISCORD_BOT_TOKEN");
		this.client.login(token);
	}

	initListeners () {
		const client = this.client;

		client.on("messageCreate", async (messageObject) => {
			const {
				commandArguments,
				chan,
				discordID,
				guild,
				msg,
				mentions,
				privateMessage,
				user
			} = this.parseMessage(messageObject);

			// If the bot does not have SEND_MESSAGES permission in the channel, completely ignore the message.
			// Do not process it for logging, commands, AFKs, Reminders, anything.
			const selfPermissions = messageObject.channel.permissionsFor?.(this.platform.Self_ID);
			if (selfPermissions && !selfPermissions.has("SEND_MESSAGES")) {
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
					if (!this.platform.Data.sendVerificationChallenge) {
						// No verification challenge - just assume it's correct
						await userData.saveProperty("Discord_ID", discordID);
					}
					else {
						if (!msg.startsWith(sb.Command.prefix)) {
							return;
						}

						const status = await DiscordController.fetchAccountChallengeStatus(userData, discordID);
						if (status === "Active") {
							return;
						}

						const { challenge } = await DiscordController.createAccountChallenge(userData, discordID);
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
				const channelData = sb.Channel.get(chan, this.platform);
				if (channelData) {
					channelData.events.emit("message", {
						event: "message",
						message: msg,
						user: null,
						channel: channelData,
						platform: this.platform,
						raw: { user }
					});
				}

				return;
			}

			if (!privateMessage) {
				channelData = sb.Channel.get(chan, this.platform);
				if (!channelData) {
					channelData = await sb.Channel.add(chan, this.platform);
					await channelData.setup();
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

				channelData.sessionData.lastActivity = {
					user: userData.ID,
					date: new sb.Date().valueOf()
				};

				this.resolveUserMessage(channelData, userData, msg);
				await sb.Logger.push(sb.Utils.wrapString(msg, this.platform.Message_Limit), userData, channelData);

				channelData.events.emit("message", {
					type: "message",
					message: msg,
					user: userData,
					channel: channelData,
					platform: this.platform
				});

				if (channelData.Mode !== "Read") {
					await sb.AwayFromKeyboard.checkActive(userData, channelData);
					await sb.Reminder.checkActive(userData, channelData);

					// Mirroring is set up - mirror the message to the target channel
					if (channelData.Mirror) {
						await this.mirror(msg, userData, channelData, { commandUsed: false });
					}
				}
			}
			else {
				if (this.platform.Logging.whispers) {
					await sb.Logger.push(msg, userData, null, this.platform);
				}

				this.resolveUserMessage(null, userData, msg);
			}

			if (channelData && channelData.Mode === "Read") {
				return;
			}

			// Own message - skip
			if (discordID === this.platform.Self_ID) {
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

				await this.handleCommand(
					command,
					args.map(i => DiscordController.removeEmoteTags(i)),
					channelData,
					userData,
					{
						mentions,
						guild,
						privateMessage,
						member: messageObject.member
					}
				);
			}
		});

		client.on("error", async (err) => {
			await sb.Logger.log("Discord.Error", err.toString(), null, null);
			this.restart();
		});
	}

	/**
	 * Sends a message
	 * @param message
	 * @param channel
	 * @param {Object} options
	 */
	async send (message, channel, options = {}) {
		const globalEmoteRegex = /[A-Z]/;
		const channelData = sb.Channel.get(channel, this.platform);
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
			const globalEmotesMap = this.client.emojis.cache;
			const guildEmotesMap = channelObject.guild.emojis.cache;
			const skipGlobalEmotes = Boolean(await channelData.getDataProperty("disableDiscordGlobalEmotes"));

			for (const word of wordSet) {
				// First, attempt to find a unique global emoji available to the bot
				let emote;
				const globalEmotes = globalEmotesMap.filter(i => i.name === word);

				if (globalEmotes.size > 0) {
					// If there are multiple, try to find it in the current guild's emojis cache and use it
					emote = guildEmotesMap.find(i => i.name === word);

					// If not found and the word is not overly common, simply pick a random emote out of the global list
					// Also take into account the Discord channel setting to ignore global emotes
					if (!emote && !skipGlobalEmotes && globalEmoteRegex.test(word) && word.length > 2) {
						emote = sb.Utils.randArray([...globalEmotes.values()]);
					}
				}

				if (emote) {
					// This regex makes sure all emotes to be replaces are not preceded or followed by a ":" (colon) character
					// All emotes on Discord are wrapped at least by colons
					const regex = new RegExp(`(?<!(:))\\b${emote.name}\\b(?!(:))`, "g");
					message = message.replace(regex, emote.toString());
				}
			}

			const guildUsers = await channelObject.guild.members.fetch();
			const sortedUsers = [...guildUsers.values()].sort((a, b) => b.user.username.length - a.user.username.length);
			for (const member of sortedUsers) {
				const name = sb.User.normalizeUsername(member.user.username);
				const regex = new RegExp(`(\\s|^)@${sb.Utils.escapeRegExp(name)}\\b`, "gi");

				message = message.replace(regex, `$1<@${member.user.id}>`);
			}
		}

		let sendTarget;
		if (Array.isArray(options.embeds) && options.embeds.length !== 0) {
			sendTarget = {
				embeds: options.embeds
			};
		}
		else if (typeof message === "string") {
			const limit = channelData.Message_Limit ?? this.platform.Message_Limit;
			message = message.replace(/\\/g, "\\\\");

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
			await channelObject.send(sendTarget);
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
				await discordUser.send(message);
			}
			else if (options.embeds && options.embeds.length !== 0) {
				await discordUser.send({
					embeds: options.embeds
				});
			}
		}
		catch (e) {
			if (!this.platform.Data.createReminderWhenSendingPrivateMessageFails) {
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
				const botData = await sb.User.get(this.platform.Self_Name);
				await sb.Reminder.create({
					User_From: botData.ID,
					User_To: userData.ID,
					Channel: null,
					Platform: this.platform.ID,
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
			await discordUser.send(message);
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
	 * @param {string} command Command invocation string
	 * @param {User} userData
	 * @param {Channel} channelData
	 * @param {Array} args
	 * @param {Object} options = {}
	 * @returns {Promise<void>}
	 */
	async handleCommand (command, args, channelData, userData, options = {}) {
		const execution = await sb.Command.checkAndExecute(command, args, channelData, userData, {
			platform: this.platform,
			...options
		});

		if (!execution) {
			return;
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
					args[i] = `@${user.username}`;
				}
			}
		}

		let index = 0;
		let targetMessage = messageObject.cleanContent.replace(/\n/g, " ");

		const extras = [...stickers, ...links];
		while (targetMessage.length < this.platform.Message_Limit && index < extras.length) {
			targetMessage += ` ${extras[index]}`;
			index++;
		}

		return {
			msg: DiscordController.removeEmoteTags(targetMessage.replace(/\s+/g, " ")),
			user: messageObject.author.username.toLowerCase().replace(/\s/g, "_"),
			chan: messageObject.channel.id,
			channelType: messageObject.channel.type,
			discordID: String(messageObject.author.id),
			author: messageObject.author,
			mentions: messageObject.mentions,
			guild: messageObject?.channel?.guild ?? null,
			privateMessage: Boolean(messageObject.channel.type.toLowerCase() === "dm"),
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
			permissions.has("MANAGE_CHANNELS")
			|| permissions.has("MANAGE_GUILD")
			|| permissions.has("ADMINISTRATOR")
		);
	}

	async fetchUserList (channelIdentifier) {
		const channel = await this.client.channels.fetch(channelIdentifier);
		const guild = await channel.guild.fetch();

		await Promise.all([
			guild.members.fetch(),
			guild.roles.fetch()
		]);

		return [...channel.members.values()].map(i => i.user.username);
	}

	async fetchChannelEmotes (channelData) {
		const discordChannel = await this.client.channels.fetch(channelData.Name);
		const guild = await this.client.guilds.fetch(discordChannel.guild.id);

		const emojis = [...guild.emojis.cache.values()];
		return emojis.map(i => ({
			ID: i.id,
			name: i.name,
			type: "discord",
			global: false,
			animated: (i.animated)
		}));
	}

	async fetchGlobalEmotes () {
		return this.client.emojis.cache.map(i => ({
			ID: i.id,
			name: i.name,
			type: "discord",
			global: true,
			animated: (i.animated)
		}));
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
