/* global sb */
module.exports = (function () {
	"use strict";

	class Discord {
		constructor () {
			this.platform = sb.Platform.get("discord");
			this.name = sb.Config.get("DISCORD_SELF");

			this.client = new (require("discord.js")).Client();

			this.initListeners();
			this.client.login(sb.Config.get("DISCORD_BOT_TOKEN"));
		}

		initListeners () {
			const client = this.client;

			client.on("ready", () => {
				sb.SystemLogger.send("Discord.Success", "Initialized");
			});

			client.on("message", async (messageObject) => {
				const commandPrefix = sb.Config.get("COMMAND_PREFIX");
				const {commandArguments, discordID, msg, chan, user, mentions, guild, privateMessage} = Discord.parseMessage(messageObject);

				let channelData = null;
				let userData = await sb.User.getByProperty("Discord_ID", discordID);

				// If no user with the given Discord ID exists, check and see if the name is already being used
				if (!userData) {
					const nameCheckData = await sb.User.get(user, true);

					// If it is, skip entirely - the name must be matched precisely to the Discord ID, and this is an anomaly
					// Needs to be fixed or flagged manually
					if (nameCheckData && nameCheckData.Discord_ID === null && nameCheckData.Twitch_ID !== null) {
						return;
					}
					// Otherwise, set up the user with their Discord ID
					else {
						userData = await sb.User.add(user);
						await userData.saveProperty("Discord_ID", discordID);
					}
				}

				if (!privateMessage) {
					channelData = sb.Channel.get(chan);
					if (!channelData) {
						channelData = await sb.Channel.add(chan, this.platform);
						await channelData.setup();
					}

					if (channelData.Mode === "Inactive") {
						return;
					}

					const channelDescription = guild.name + " - #" + messageObject.channel.name;
					if (channelData.Description !== channelDescription) {
						await channelData.saveProperty("Description", channelDescription);
					}

					if (channelData.NSFW !== messageObject.channel.nsfw) {
						await channelData.saveProperty("NSFW", messageObject.channel.nsfw);
					}

					sb.Logger.push(msg, userData, channelData);

					if (channelData.Mode !== "Read") {
						sb.AwayFromKeyboard.checkActive(userData, channelData);
						sb.Reminder.checkActive(userData, channelData);
					}

					// Mirroring is set up - mirror the message to the target channel
					if (channelData.Mirror) {
						this.mirror(msg, userData, channelData);
					}
				}

				if (channelData && channelData.Mode === "Read") {
					return;
				}

				// Own message - skip
				if (discordID === sb.Config.get("DISCORD_SELF_ID")) {
					return;
				}

				sb.Master.globalMessageListener(this.platform, channelData, userData, msg);

				// Starts with correct prefix - handle command
				if (msg.startsWith(commandPrefix)) {
					const command = msg.replace(commandPrefix, "").split(" ")[0];
					const args = msg.split(/\s+/).slice(1).filter(Boolean);

					this.handleCommand(
						command,
						commandArguments.slice(1).map(i => Discord.removeEmoteTags(i)),
						channelData,
						userData,
						{
							mentions,
							guild,
							privateMessage
						}
					);
				}
			});wu

			client.on("error", (err) => {
				console.error(err);
				sb.SystemLogger.send("Discord.Error", err.description);
				this.restart();
			});
		}

		/**
		 * Sends a message
		 * @param message
		 * @param channel
		 */
		async send (message, channel) {
			const discordChannel = sb.Channel.get(channel).Name;
			const channelObject = this.client.channels.get(discordChannel);
			if (!channelObject) {
				console.warn("No channel available!", channel);
				return;
			}

			if (channelObject.guild) {
				const wordList = message.split(/\W+/).filter(Boolean);
				for (const word of wordList) {
					const emote = channelObject.guild.emojis.find(i => i.name === word);
					if (emote) {
						// This regex makes sure all emotes to be replaces are not preceded or followed by a ":" (colon) character
						// All emotes on Discord are wrapped at least by colons
						const regex = new RegExp("(?<!(:))\\b" + emote.name + "\\b(?!(:))", "g");
						message = message.replace(regex, emote.toString());
					}
				}

				const mentionedUsers = await Discord.getMentionsInMessage(message);
				for (const user of mentionedUsers) {
					if (user.Discord_ID) {
						const regex = new RegExp("@" + user.Name, "gi");
						message = message.replace(regex, "<@" + user.Discord_ID + ">");
					}
				}
			}

			channelObject.send(sb.Utils.wrapString(message, 2000));
		}

		/**
		 * Sends a private message.
		 * The user in question must have their Discord ID filled out, otherwise the method fails.
		 * @param {User|string|number} user
		 * @param {string} msg
		 * @returns {Promise<void>}
		 * @throws {sb.Error} If the provided user does not exist
		 * @throws {sb.Error} If the provided user has no Discord ID connected.
		 */
		async pm (user, msg) {
			const userData = await sb.User.get(user, true);
			if (!userData.Discord_ID) {
				throw new sb.Error({
					message: `Discord PM attempt: User ${userData.Name} has no Discord ID`
				});
			}

			const discordUser = await this.client.fetchUser(userData.Discord_ID);
			discordUser.send(msg);
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
					platform: "discord",
				});

				this.pm(userData, message);
			}
			else {
				const message = await sb.Master.prepareMessage(execution.reply, channelData, { skipBanphrases: true });
				this.send(message, channelData);
			}
		}

		mirror (message, userData, channelData, commandUsed = false) {
			const prefix = sb.Config.get("MIRROR_IDENTIFIER_DISCORD");
			const fixedMessage = (commandUsed)
				? prefix + " " + Discord.removeEmoteTags(message)
				: prefix + " " + userData.Name + ": " + Discord.removeEmoteTags(message);

			sb.Master.mirror(fixedMessage, userData, channelData.Mirror);
		}

		destroy () {
			this.client && this.client.destroy();
			this.client = null;
		}

		restart () {
			sb.Master.reloadClientModule(this.platform, false);
			this.destroy();
		}

		static parseMessage (messageObject) {
			const args = messageObject.content.split(" ");
			for (let i = 0; i < args.length; i++) {
				const match = args[i].match(/<@!(\d+)>/);
				if (match) {
					const user = messageObject.mentions.users.get(match[1]);
					if (user) {
						args[i] = "@" + user.username;
					}
				}
			}

			return {
				msg: Discord.removeEmoteTags(
					messageObject.cleanContent.replace(/\n/g, " ") + " " + messageObject.attachments.map(i => i.proxyURL)
				).replace(/\s+/g, " "),
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

		static removeEmoteTags (message) {
			return message.replace(/<a?:(.*?):(\d*)>/g, (total, emote) => emote + " ").trim();
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
	}

	return Discord;
})();