const MC = require("minecraft-protocol");
const { autoVersionForge } = require("minecraft-protocol-forge");
const messageEvents = ["chat.type.announcement", "chat.type.text"];

module.exports = class Minecraft extends require("./template.js") {
	constructor () {
		super();

		this.platform = sb.Platform.get("minecraft");
		if (!this.platform) {
			throw new sb.Error({
				message: "Minecraft platform has not been created"
			});
		}
		else if (!sb.Config.has("MINECRAFT_BOT_EMAIL", true)) {
			throw new sb.Error({
				message: "Cytube account email has not been configured"
			});
		}
		else if (!sb.Config.has("MINECRAFT_BOT_PASSWORD", true)) {
			throw new sb.Error({
				message: "Cytube account password has not been configured"
			});
		}

		/** @type {Map<Channel, Client>} */
		this.channelMap = new Map();
		this.channels = sb.Channel.getJoinableForPlatform(this.platform);

		for (const channelData of this.channels) {
			const data = channelData.Data;
			const options = {
				host: channelData.Specific_ID,
				port: data.port ?? null,
				username: data.specificUsername ?? sb.Config.get("MINECRAFT_BOT_EMAIL")
			};

			if (data.skipPassword !== true) {
				options.password = (data.passwordConfig)
					? sb.Config.get(data.passwordConfig)
					: sb.Config.get("MINECRAFT_BOT_PASSWORD");
			}

			const client = MC.createClient(options);
			if (data.type === "forge") {
				autoVersionForge(client);
			}

			this.channelMap.set(channelData, client);
		}

		this.initListeners();
	}

	initListeners () {
		for (const [channelData, client] of this.channelMap) {
			client.on("chat", async (packet) => {
				const messageData = JSON.parse(packet.message);
				const { ignore, message, username } = Minecraft.parseMessage(channelData.Data.type, messageData);
				if (ignore) {
					return;
				}

				const userData = await sb.User.get(username, false);
				if (!userData) {
					if (channelData) {
						channelData.events.emit("message", {
							event: "message",
							message,
							user: null,
							channel: channelData,
							raw: {
								user: username
							}
						});
					}

					return;
				}

				this.resolveUserMessage(channelData, userData, message);

				if (channelData.Mode === "Last seen") {
					await sb.Logger.updateLastSeen({ userData, channelData, message });
					return;
				}
				else if (channelData.Mode === "Inactive") {
					return;
				}
				else if (channelData.Mode === "Read") {
					return;
				}

				if (channelData.Custom_Code) {
					channelData.Custom_Code({
						type: "message",
						message: message,
						user: userData,
						channel: channelData
					});
				}

				this.channelData.events.emit("message", {
					type: "message",
					message,
					user: userData,
					channel: channelData
				});

				sb.AwayFromKeyboard.checkActive(userData, channelData);
				sb.Reminder.checkActive(userData, channelData);

				if (channelData.Mirror) {
					this.mirror(message, userData, channelData);
				}

				if (username === this.platform.Self_Name) {
					return;
				}

				// Check and execute command if necessary
				if (sb.Command.is(message)) {
					const [command, ...args] = message.replace(sb.Command.prefix, "").split(" ").filter(Boolean);
					await this.handleCommand(command, userData, channelData, args, {});
				}
			});

			client.on("error", (err) => {
				if (err.message?.includes("undefined")) {
					return;
				}

				console.warn("Minecraft error", { channelData, err });
			});
		}
	}

	/**
	 * @param {string} message
	 * @param {Channel} channelData
	 */
	async send (message, channelData) {
		const client = this.channelMap.get(channelData);
		if (!client) {
			throw new sb.Error({
				message: "No Minecraft client found foor given channel",
				args: { channelData, message}
			});
		}

		client.write("chat", { message });
	}

	/**
	 * @param {string} message Private message
	 * @param {string} user User the private message will be sent to
	 */
	async pm (message, user) {
		throw new sb.Error({
			message: "Not yet implemented",
			args: { message, user }
		});
	}

	/**
	 * Handles the execution of a command and the reply should it be successful.
	 * @param {string} command
	 * @param {User} userData
	 * @param {Channel} channelData
	 * @param {string[]} [args]
	 * @param {Object} options = {}
	 * @returns {boolean} Whether or not a command has been executed.
	 */
	async handleCommand (command, userData, channelData, args = [], options = {}) {
		options.platform = options.platform ?? this.platform;

		const execution = await sb.Command.checkAndExecute(command, args, channelData, userData, options);
		if (!execution || !execution.reply) {
			return;
		}

		if (execution.replyWithPrivateMessage) {
			this.pm(execution.reply, userData.Name);
		}
		else {
			if (channelData.Mirror) {
				this.mirror(execution.reply, userData, true);
			}

			const message = await sb.Master.prepareMessage(execution.reply, channelData, { skipBanphrases: true });
			if (message) {
				this.send(message, channelData);
			}
		}
	}

	static parseMessage (type, data) {
		if (type === "vanilla") {
			if (!messageEvents.includes(data.translate)) {
				return { ignore: true };
			}

			const username = data.with[0].text.toLowerCase();
			const message = data.with[1].toLowerCase();
			return {
				ignore: false,
				message,
				username
			};
		}
		else if (type === "forge") {
			const messageData = data.extra ?? [];
			const nameObject = messageData[0]?.extra ?? null;
			if (!nameObject) {
				return { ignore: true };
			}

			const message = messageData[1].text ?? "";
			const username = Object.values(nameObject).map(i => i.insertion).filter(Boolean).join("").toLowerCase();
			return {
				ignore: false,
				message,
				username
			};
		}
	}

	/**
	 * Destroys and cleans up the instance
	 */
	destroy () {
		this.channelMap.clear();
	}
};