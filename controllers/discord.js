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

		const { Client, Intents } = require("discord.js");
		const intents = new Intents();
		intents.add(Intents.NON_PRIVILEGED, "GUILD_MEMBERS");

		this.client = new Client({
			ws: { intents },
			disableMentions: "everyone"
		});

		this.initListeners();

		this.client.login(sb.Config.get("DISCORD_BOT_TOKEN"));
	}

	initListeners () {
		const client = this.client;

		client.on("ready", async () => {
			const active = client.channels.cache.filter(i => i.type === "text");
			const joinable = sb.Channel.getJoinableForPlatform("discord");

			for (const channel of joinable) {
				const exists = active.find(i => i.id === channel.Name);
				if (!exists) {
					channel.Mode = "Inactive";
					await channel.saveProperty("Mode", channel.Mode);
					console.debug("Discord channel set as inactive", channel);
				}
			}
		});

		client.on("message", async (messageObject) => {
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

			if (Array.from(user).length > 32) {
				console.debug("Invalid Discord username! user.length > 32, skipping", {
					chan, discordID, guild, msg, user, userLength: user.length
				});

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
						if (userData.Data.discordChallengeNotificationSent || !msg.startsWith(sb.Command.prefix)) {
							return;
						}

						const { challenge } = await DiscordController.createAccountChallenge(userData, discordID);
						userData.Data.discordChallengeNotificationSent = true;
						await userData.saveProperty("Data");

						await this.directPm(
							discordID,
							sb.Utils.tag.trim `
								You were found to be likely to own a Twitch account with the same name as your current Discord account.
								If you want to use my commands on Discord, whisper me the following command on Twitch:
								${sb.Command.prefix}link ${challenge}
							 `
						);

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

				// If a message comes from a channel set as "Inactive", this means it is active again.
				// Change its mode back to active.
				if (channelData.Mode === "Inactive") {
					channelData.Mode = "Write";
					await channelData.saveProperty("Mode", channelData.Mode);
				}

				const channelDescription = guild.name + " - #" + messageObject.channel.name;
				if (channelData.Description !== channelDescription) {
					await channelData.saveProperty("Description", channelDescription);
				}

				if (channelData.NSFW !== messageObject.channel.nsfw) {
					await channelData.saveProperty("NSFW", messageObject.channel.nsfw);
				}

				channelData.sessionData.lastActivity = {
					user: userData.ID,
					date: new sb.Date().valueOf()
				};

				this.resolveUserMessage(channelData, userData, msg);
				sb.Logger.push(msg, userData, channelData);

				if (channelData.Mode !== "Read") {
					sb.AwayFromKeyboard.checkActive(userData, channelData);
					sb.Reminder.checkActive(userData, channelData);

					channelData.events.emit("message", {
						type: "message",
						message: msg,
						user: userData,
						channel: channelData,
						platform: this.platform
					});

					// Mirroring is set up - mirror the message to the target channel
					if (channelData.Mirror) {
						this.mirror(msg, userData, channelData);
					}
				}
			}
			else {
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
				const [command] = msg.replace(commandPrefix, "").split(" ").filter(Boolean);
				const args = (commandArguments[0] === commandPrefix)
					? commandArguments.slice(2)
					: commandArguments.slice(1);

				this.handleCommand(
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

		client.on("error", (err) => {
			console.error(err);
			this.restart();
		});
	}

	/**
	 * Sends a message
	 * @param message
	 * @param channel
	 */
	async send (message, channel) {
		const channelData = sb.Channel.get(channel, this.platform).Name;
		const channelObject = this.client.channels.cache.get(channelData);
		if (!channelObject) {
			console.warn("No channel available!", channel);
			return;
		}

		if (channelObject.guild) {
			const wordList = message.split(/\W+/).filter(Boolean);
			for (const word of wordList) {
				// First, attempt to find a unique global emoji available to the bot
				let emote;
				const globalEmotes = this.client.emojis.cache.filter(i => i.name === word);

				if (globalEmotes.length > 0) {
					// If there are multiple, try to find it in the current guild's emojis cache and use it
					emote = channelObject.guild.emojis.cache.find(i => i.name === word);

					// If not found, just try and use the first one found in the list
					emote = emote ?? globalEmotes[0];
				}

				if (emote) {
					// This regex makes sure all emotes to be replaces are not preceded or followed by a ":" (colon) character
					// All emotes on Discord are wrapped at least by colons
					const regex = new RegExp("(?<!(:))\\b" + emote.name + "\\b(?!(:))", "g");
					message = message.replace(regex, emote.toString());
				}
			}

			const mentionedUsers = await DiscordController.getMentionsInMessage(message);
			for (const user of mentionedUsers) {
				if (user.Discord_ID) {
					const regex = new RegExp("@" + user.Name, "gi");
					message = message.replace(regex, "<@" + user.Discord_ID + ">");
				}
			}
		}

		channelObject.send(sb.Utils.wrapString(message, channelData.Message_Limit ?? this.platform.Message_Limit));
	}

	/**
	 * Sends a private message.
	 * The user in question must have their Discord ID filled out, otherwise the method fails.
	 * @param {string} message
	 * @param {User|string|number} user
	 * @returns {Promise<void>}
	 * @throws {sb.Error} If the provided user does not exist
	 * @throws {sb.Error} If the provided user has no Discord ID connected.
	 */
	async pm (message, user) {
		const userData = await sb.User.get(user, true);
		if (!userData.Discord_ID) {
			throw new sb.Error({
				message: `Discord PM attempt: User ${userData.Name} has no Discord ID`
			});
		}

		const discordUser = await this.client.users.fetch(userData.Discord_ID);
		await discordUser.send(message);
	}

	/**
	 * Directly sends a private message to user, without them necessarily being saved as a user.
	 * @param {string} userID
	 * @param {string }msg
	 * @returns {Promise<void>}
	 */
	async directPm (userID, msg) {
		const discordUser = await this.client.users.fetch(userID);
		await discordUser.send(msg);
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

		if (!execution || !execution.reply) {
			return;
		}

		if (channelData?.Mirror) {
			this.mirror(execution.reply, userData,channelData, true);
		}

		if (options.privateMessage || execution.replyWithPrivateMessage) {
			const message = await sb.Master.prepareMessage(execution.reply, null, {
				platform: this.platform
			});

			this.pm(message, userData);
		}
		else {
			const message = await sb.Master.prepareMessage(execution.reply, channelData, { skipBanphrases: true });
			this.send(message, channelData);
		}
	}

	destroy () {
		this.client && this.client.destroy();
		this.client = null;
	}

	parseMessage (messageObject) {
		const args = messageObject.content.split(" ");
		for (let i = 0; i < args.length; i++) {
			const match = args[i].match(/<@!?(\d+)>/);
			if (match) {
				const user = messageObject.mentions.users.get(match[1]);
				if (user) {
					args[i] = "@" + user.username;
				}
			}
		}

		let index = 0;
		const links = messageObject.attachments.map(i => i.proxyURL);
		let targetMessage = messageObject.cleanContent.replace(/\n/g, " ");
		while (targetMessage.length < this.platform.Message_Limit && index < links.length) {
			targetMessage += " " + links[index];
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
			privateMessage: Boolean(messageObject.channel.type === "dm"),
			commandArguments: args
		};
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

	static removeEmoteTags (message) {
		return message.replace(/<a?:(.*?):(\d*)>/g, (total, emote) => emote + " ").trim();
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

	static async getMentionsInMessage (message) {
		return (await Promise.all(
			message.replace(/^.*?@/, "@")
				.replace(/\s+/g, "_")
				.split(/[^@\w]/)
				.filter(i => i.startsWith("@") || i.startsWith("_@"))
				.map(i => i.replace(/^_|_$/g, ""))
				.filter(Boolean)
				.flatMap(i => {
					const names = [];
					let name = "";
					i.split("_").forEach(i => {
						if (name) {
							name += "_";
						}
						name += i;
						names.push(name);
					});

					return names;
				})
				.map(user => sb.User.get(user))
		)).filter(Boolean);
	}
};