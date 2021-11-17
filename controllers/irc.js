const IRC = require("irc-framework");

module.exports = class IRCController extends require("./template.js") {
	constructor (options) {
		super();

		if (!options.host) {
			throw new sb.Error({
				message: "Invalid IRC platform options - missing host",
				args: { options }
			});
		}

		this.platform = sb.Platform.get("irc", options.host);
		if (!this.platform) {
			throw new sb.Error({
				message: "IRC platform has not been created"
			});
		}
		else if (!this.platform.Self_Name) {
			throw new sb.Error({
				message: "IRC platform does not have the bot's name configured"
			});
		}

		this.client = new IRC.Client();
		this.client.connect({
			host: this.platform.Data.url ?? options.host,
			port: this.platform.Data.port ?? 6667,
			nick: this.platform.Self_Name,
			tls: this.platform.Data.secure ?? this.platform.Data.tls ?? false
		});

		this.nicknameChanged = false;

		this.initListeners();
	}

	initListeners () {
		const { client } = this;

		client.on("debug", (...args) => console.debug("debug", args));

		client.on("registered", () => {
			const { authentication } = this.platform.Data ?? {};
			if (authentication.type === "privmsg-identify") {
				const { configVariable, user } = authentication;
				const key = sb.Config.get(configVariable, false);
				if (!key) {
					throw new sb.Error({
						message: "Invalid IRC authentication key exists in sb.Config",
						args: { configVariable }
					});
				}

				const message = `IDENTIFY ${this.platform.Self_Name} ${key}`;
				this.directPm(user, message);

				if (this.nicknameChanged) {
					this.nicknameChanged = false;
					this.directPm(user, `REGAIN ${this.platform.Self_Name}`);
				}
			}

			const channelsData = sb.Channel.getJoinableForPlatform(this.platform);
			for (const channelData of channelsData) {
				this.client.join(`#${channelData.Name}`);
			}
		});

		client.on("join", async (event) => {
			console.log("JOIN", { event });
		});

		client.on("nick in use", async () => {
			const string = sb.Utils.randomString(16);
			this.client.changeNick(string);
			this.nicknameChanged = true;
		});

		client.on("privmsg", async (event) => await this.handleMessage(event));
	}

	async send (message, channel) {
		const channelData = sb.Channel.get(channel, this.platform);
		if (!channelData) {
			throw new sb.Error({
				message: "Invalid channel provided",
				args: { message, channel }
			});
		}

		this.client.say(`#${channelData.Name}`, message);
	}

	async pm (message, user) {
		const userData = await sb.User.get(user);
		if (!userData) {
			return;
		}

		this.client.say(userData.Name, message);
	}

	async directPm (message, userName) {
		this.client.say(userName, message);
	}

	async handleMessage (event) {
		if (event.from_server) {
			console.log("server message", { event });
			return;
		}

		// TODO verify user
		// idea:
		// 1) ignore all non-registered users;
		// 2a) registered users receive a prompt to link their account (if it already exists)
		// 2b) added registered users without an existing user_alias (?)
		// see userlist/whois/whowas/details
		const { message } = event;
		const userData = await sb.User.get(event.nick, true);
		if (!userData) {
			return;
		}

		const isPrivateMessage = (event.target === this.platform.Self_Name.toLowerCase());
		let channelData = null;
		if (!isPrivateMessage) {
			channelData = sb.Channel.get(event.target, this.platform);

			if (!channelData) {
				return;
			}

			await this.resolveUserMessage(channelData, userData, message);

			if (channelData.Mode === "Last seen") {
				await sb.Logger.updateLastSeen({ userData, channelData, message });
				return;
			}
			else if (channelData.Mode === "Inactive") {
				return;
			}

			if (this.platform.Logging.messages) {
				await sb.Logger.push(message, userData, channelData);
			}

			channelData.events.emit("message", {
				event: "message",
				message,
				user: userData,
				channel: channelData,
				platform: this.platform,
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
			if (this.platform.Logging.whispers) {
				await sb.Logger.push(message, userData, null, this.platform);
			}

			this.resolveUserMessage(null, userData, message);
		}

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
			platform: this.platform,
			...options
		});

		if (!execution || !execution.reply) {
			return execution;
		}

		const commandOptions = sb.Command.extractMetaResultProperties(execution);
		if (options.privateMessage || execution.replyWithPrivateMessage) {
			const message = await this.prepareMessage(execution.reply, null, {
				...commandOptions,
				extraLength: (`/w ${userData.Name} `).length,
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
				skipBanphrases: true
			});

			if (message) {
				await this.send(message, channelData);
			}
		}

		return execution;
	}

	async isUserChannelOwner (channelData, userData) {
		throw new Error("Not yet implemented");
	}

	async fetchUserList (channelIdentifier) {
		throw new Error("Not yet implemented");
	}
};
