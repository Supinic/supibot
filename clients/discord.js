/* global sb */
module.exports = (function () {
	"use strict";

	class Discord {
		constructor (parent, options) {
			this.platform = "Discord";

			/** @type Master */
			this.parent = parent;
			this.name = options.name;

			// @todo change client module name - collides with discord.js module
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
				const {discordID, msg, chan, user, mentions, guild, privateMessage} = Discord.parseMessage(messageObject);

				let channelData = sb.Channel.get(chan);
				if (!channelData) {
					channelData = await sb.Channel.add(chan, 2);
					await channelData.setup();
				}

				let userData = await sb.User.getByProperty("Discord_ID", discordID);

				// If no user with the given Discord ID exists, check and see if the name is already being used
				if (!userData) {
					const nameCheckData = await sb.User.getByProperty("Name", user);

					// If it is, skip entirely - the name must be matched precisely to the Discord ID, and this is an anomaly
					// Needs to be fixed or flagged manually
					if (nameCheckData && nameCheckData.Discord_ID !== null) {
						const message = "User ID anomaly: " + user + " (" +  discordID + "), compared to " + nameCheckData.Name + " (" + nameCheckData.Discord_ID + ")";
						sb.SystemLogger.send("Discord.Warning", message, channelData);
						return;
					}
					// Otherwise, set up the user with their Discord ID
					else {
						userData = await sb.User.add(user);
						await userData.saveProperty("Discord_ID", discordID);
					}
				}

				// Do not process mirrored messages
				if (userData.ID === sb.Config.get("SELF_ID") && sb.Config.get("MIRROR_IDENTIFIERS").includes(Array.from(msg)[0])) {
					return;
				}
				
				sb.Logger.push(msg, userData, channelData);

				// Own message - skip
				if (discordID === sb.Config.get("DISCORD_SELF_ID")) {
					return;
				}

				sb.AwayFromKeyboard.checkActive(userData, channelData, this.parent);
				sb.Reminder.checkActive(userData, channelData, this.parent);

				// Mirroring is set up - mirror the message to the target channel
				if (channelData.Mirror) {
					this.mirror(msg, userData, channelData);
				}

				// Starts with correct prefix - handle command
				if (msg.startsWith(this.parent.commandPrefix)) {
					const command = msg.replace(this.parent.commandPrefix, "").split(" ")[0];
					const args = msg.split(/\s+/).slice(1).filter(Boolean);
					this.handleCommand(command, args, channelData, userData, {mentions, guild, privateMessage});
				}
			});

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

			// @todo parse in/out discord emotes?

			const channelObject = this.client.channels.get(discordChannel);
			if (!channelObject) {
				console.warn("No channel available!", channel);
			}

			if (channelObject.guild) {
				if (!channelObject.guild.reverseEmotes) {
					channelObject.guild.reverseEmotes = new Map();
					for (const emote of channelObject.guild.emojis.values()) {
						channelObject.guild.reverseEmotes.set(emote.name, emote);
					}
				}

				message.split(" ").forEach(word => {
					const emote = channelObject.guild.reverseEmotes.get(word);
					if (emote) {
						const regex = new RegExp("(?<!(:))" + emote.name + "(?!(:))", "g");
						message = message.replace(regex, emote.toString());
					}
				});

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
			const execution = await sb.Command.checkAndExecute(command, args, channelData, userData, options);
			if (!execution || !execution.reply) {
				return;
			}

			if (channelData.Mirror) {
				this.mirror(execution.reply, userData,channelData, true);
			}

			const message = await this.parent.prepareMessage(execution.reply, channelData, { skipBanphrases: true });
			if (execution.replyWithPrivateMessage) {
				this.pm(userData, message);
			}
			else if (message) {
				this.send(message, channelData);
			}
		}

		mirror (message, userData, channelData, commandUsed = false) {
			const fixedMessage = (commandUsed)
				? "🇩 " + Discord.removeEmoteTags(message)
				: "🇩 " + userData.Name[0] + userData.Name.slice(1) + ": " + Discord.removeEmoteTags(message);

			this.parent.mirror(fixedMessage, userData, channelData.Mirror);
		}

		destroy () {
			this.client && this.client.destroy();
			this.client = null;
		}

		restart () {
			this.parent.reloadClientModule(this.platform, false);
			this.destroy();
		}

		static parseMessage (messageObject) {
			return {
				msg: Discord.removeEmoteTags(
					messageObject.cleanContent.replace(/\n/g, " ") + " " + messageObject.attachments.map(i => i.proxyURL)
				).replace(/\s+/g, " "),
				user: messageObject.author.username.toLowerCase().replace(/\s/g, "_"),
				chan: messageObject.channel.id,
				discordID: String(messageObject.author.id),
				author: messageObject.author,
				mentions: messageObject.mentions,
				guild: (messageObject.member) ? messageObject.member.guild : null,
				privateMessage: Boolean(messageObject.channel.type === "dm")
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