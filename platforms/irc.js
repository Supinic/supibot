const IRC = require("irc-framework");
const DEFAULT_LOGGING_CONFIG = {
	messages: true,
	whispers: false
};
const DEFAULT_PLATFORM_CONFIG = {};
const DEFAULT_IRC_PORT = 6667;

module.exports = class IRCPlatform extends require("./template.js") {
	#notifiedUnregisteredUsers = new Set();
	#nicknameChanged = false;

	constructor (config) {
		super("irc", config, {
			logging: DEFAULT_LOGGING_CONFIG,
			platform: DEFAULT_PLATFORM_CONFIG
		});

		if (!this.host) {
			throw new sb.Error({
				message: "Invalid IRC configuration - missing host"
			});
		}
		else if (!this.selfName) {
			throw new sb.Error({
				message: "Invalid IRC configuration - missing bot's selfName"
			});
		}
		else if (!this.config.url) {
			throw new sb.Error({
				message: "Invalid IRC configuration - missing url"
			});
		}
	}

	async connect () {
		this.client = new IRC.Client();

		this.initListeners();

		await this.client.connect({
			host: this.config.url,
			port: this.config.port ?? DEFAULT_IRC_PORT,
			nick: this.selfName,
			tls: this.config.secure ?? this.config.tls ?? false,
			enable_echomessage: true
		});
	}

	initListeners () {
		const { client } = this;

		client.on("registered", () => {
			const { authentication } = this.config;
			if (authentication.type === "privmsg-identify") {
				const { envVariable, user } = authentication;
				const key = process.env[envVariable];
				if (!key) {
					throw new sb.Error({
						message: "No IRC identification configured",
						args: { envVariable }
					});
				}

				const message = `IDENTIFY ${this.selfName} ${key}`;
				this.directPm(message, user);

				if (this.#nicknameChanged) {
					this.#nicknameChanged = false;
					this.directPm(`REGAIN ${this.selfName} ${key}`, user);
				}
			}

			const channelsData = sb.Channel.getJoinableForPlatform(this);
			for (const channelData of channelsData) {
				this.client.join(channelData.Name);
			}
		});

		// client.on("join", async (event) => {
		// 	console.log("JOIN", { event });
		// });

		client.on("nick in use", async () => {
			const string = sb.Utils.randomString(16);
			this.client.changeNick(string);
			this.#nicknameChanged = true;
		});

		client.on("privmsg", async (event) => await this.handleMessage(event));
	}

	async send (message, channel) {
		const channelData = sb.Channel.get(channel, this);
		if (!channelData) {
			throw new sb.Error({
				message: "Invalid channel provided",
				args: {
					message,
					channel
				}
			});
		}

		this.client.say(channelData.Name, message);
		this.incrementMessageMetric("sent", channelData);
	}

	async pm (message, user) {
		const userData = await sb.User.get(user);
		if (!userData) {
			return;
		}

		this.client.say(userData.Name, message);
		this.incrementMessageMetric("sent", null);
	}

	async directPm (message, userName) {
		this.client.say(userName, message);
		this.incrementMessageMetric("sent", null);
	}

	async prepareMessage (message, channel, options = {}) {
		const preparedMessage = await super.prepareMessage(message, channel, {
			...options,
			skipLengthCheck: true
		});

		const limit = (this.messageLimit * 2) - (options.extraLength ?? 0);
		return sb.Utils.wrapString(preparedMessage, limit);
	}

	async handleMessage (event) {
		if (event.from_server) {
			return;
		}

		const { message } = event;
		const isPrivateMessage = (event.target === this.selfName);

		if (!event.tags.account) {
			const userName = event.nick;
			if (sb.Command.is(message) && !this.#notifiedUnregisteredUsers.has(userName)) {
				const message = `You must register an account before using my commands!`;

				this.client.say(event.target, message);
				this.#notifiedUnregisteredUsers.add(userName);
			}

			return;
		}

		const userData = await sb.User.get(event.tags.account, false);
		if (!userData) {
			return;
		}

		let userVerificationData = await userData.getDataProperty("platformVerification");
		userVerificationData ??= {};
		userVerificationData[this.ID] ??= {};

		const isSelf = (userData.Name === this.platform.Self_Name);
		const platformVerification = userVerificationData[this.ID];
		if (!isSelf && (userData.Twitch_ID || userData.Discord_ID) && !platformVerification.active) {
			// TODO: verification challenge creation for Discord/Twitch and sending the message
			if (!platformVerification.notificationSent) {
				const accountType = (userData.Twitch_ID) ? "Twitch" : "Discord";
				const message = sb.Utils.tag.trim `
					@${userData.Name},
					You were found to be likely to own a ${accountType} account with the same name as your current IRC account.
					Please contact @Supinic to resolve this manually (for now).
				`;

				if (isPrivateMessage) {
					await this.send(message, event.target);
				}
				else {
					await this.pm(message, userData.Name);
				}

				platformVerification.notificationSent = true;
				await userData.setDataProperty("platformVerification", userVerificationData);
			}

			return;
		}

		let channelData = null;
		if (!isPrivateMessage) {
			channelData = sb.Channel.get(event.target, this);

			if (!channelData) {
				return;
			}
			else if (channelData.Mode === "Inactive") {
				return;
			}

			await this.resolveUserMessage(channelData, userData, message);

			if (channelData.Logging.has("Meta")) {
				await sb.Logger.updateLastSeen({
					userData,
					channelData,
					message
				});
			}
			if (this.logging.messages && channelData.Logging.has("Lines")) {
				await sb.Logger.push(message, userData, channelData);
			}

			channelData.events.emit("message", {
				event: "message",
				message,
				user: userData,
				channel: channelData,
				platform: this,
				data: {}
			});

			// If channel is read-only, do not proceed with any processing
			// Such as un-AFK message, reminders, commands, ...
			if (channelData.Mode === "Read") {
				return;
			}

			await Promise.all([
				sb.AwayFromKeyboard.checkActive(userData, channelData),
				sb.Reminder.checkActive(userData, channelData)
			]);

			// Mirror messages to a linked channel, if the channel has one
			if (channelData.Mirror) {
				await this.mirror(message, userData, channelData, { commandUsed: false });
			}
		}
		else {
			if (this.logging.whispers) {
				await sb.Logger.push(message, userData, null, this);
			}

			this.resolveUserMessage(null, userData, message);
		}

		this.incrementMessageMetric("read", channelData);

		if (!sb.Command.prefix) {
			return;
		}

		if (sb.Command.is(message)) {
			const [command, ...args] = message
				.replace(sb.Command.prefix, "")
				.split(/\s+/)
				.filter(Boolean);

			await this.handleCommand(command, userData, channelData, args, {
				privateMessage: isPrivateMessage
			});
		}
	}

	async handleCommand (command, userData, channelData, args = [], options = {}) {
		const execution = await sb.Command.checkAndExecute(command, args, channelData, userData, {
			platform: this,
			...options
		});

		if (!execution || !execution.reply) {
			return execution;
		}

		const commandOptions = sb.Command.extractMetaResultProperties(execution);
		if (options.privateMessage || execution.replyWithPrivateMessage) {
			const message = await this.prepareMessage(execution.reply, null, {
				...commandOptions,
				extraLength: (`PRIVMSG ${userData.Name} `).length,
				skipBanphrases: true
			});

			await this.pm(message, userData.Name);
		}
		else {
			if (channelData?.Mirror) {
				await this.mirror(execution.reply, userData, channelData, {
					...commandOptions,
					commandUsed: true
				});
			}

			const message = await this.prepareMessage(execution.reply, channelData, {
				...commandOptions,
				extraLength: (`PRIVMSG ${channelData.Name} `).length,
				skipBanphrases: true
			});

			if (message) {
				await this.send(message, channelData);
			}
		}

		return execution;
	}

	async isUserChannelOwner () {
		return false;
	}

	async populateUserList () { return []; }
	async populateGlobalEmotes () { return []; }
	async fetchChannelEmotes () { return []; }

	async fetchInternalPlatformIDByUsername () {
		throw new sb.Error({
			message: "IRC does not support user platform ID lookup by username"
		});
	}

	async fetchUsernameByUserPlatformID () {
		throw new sb.Error({
			message: "IRC does not support username lookup by user platform ID"
		});
	}

	me () {
		throw new sb.Error({
			message: "The /me action is not supported on IRC"
		});
	}
};
