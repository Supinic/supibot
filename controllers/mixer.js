/* global sb */

const MixerClient = require("@mixer/client-node");
const ws = require("ws");

module.exports = class Mixer extends require("./template.js") {
	constructor () {
		super();

		this.platform = sb.Platform.get("mixer");
		if (!this.platform) {
			throw new sb.Error({
				message: "Mixer platform has not been created"
			});
		}
		else if (!sb.Config.has("MIXER_OAUTH", true)) {
			throw new sb.Error({
				message: "Mixer oauth token has not been configured"
			});
		}

		this.client = new MixerClient.Client(new MixerClient.DefaultRequestRunner());

		// With OAuth we don't need to log in. The OAuth Provider will attach
		// the required information to all of our requests after this call.
		this.client.use(new MixerClient.OAuthProvider(this.client, {
			tokens: {
				access: sb.Config.get("MIXER_OAUTH"),
				expires: sb.Date.now() + (365 * 24 * 60 * 60 * 1000)
			},
		}));

		this.initListeners();
	}

	async initListeners () {
		this.channels = sb.Channel.getJoinableForPlatform(this.platform);

		// Gets the user that the Access Token we provided above belongs to.
		this.userInfo = (await this.client.request("GET", "/users/current")).body;

		this.channelsData = await Promise.all(this.channels.map(async (channelData) => {
			const { id: channelID } = await sb.Got.instances.Mixer({
				url: "channels/" + channelData.Name,
				searchParams: "fields=id"
			}).json();

			const chatData = (await new MixerClient.ChatService(this.client).join(channelID)).body;
			if (!channelData.Specific_ID) {
				await channelData.saveProperty("Specific_ID", channelID);
			}

			// Chat connection
			const socket = new MixerClient.Socket(ws, chatData.endpoints).boot();

			socket.on("UserJoin", data => {
				console.log("User joined", data);
			});

			socket.on("ChatMessage", data => {
				this.handleMessage(data, socket);
			});

			// Handle errors
			socket.on("error", error => {
				console.error("Socket error", error);
			});

			await socket.auth(channelID, this.userInfo.id, chatData.authkey);

			return {
				name: channelData.Name,
				id: channelData.Specific_ID,
				socket: socket
			};
		}));
	}

	/**
	 * Sends a message
	 * @param message
	 * @param channelData
	 */
	async send (message, channelData) {
		const socketData = this.channelsData.find(i => i.name === channelData.Name);
		if (!socketData) {
			throw new sb.Error({
				message: "No socket associated with channel",
				args: arguments
			});
		}

		socketData.socket.call("msg", [message]);
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
		throw new sb.errors.NotImplemented();
	}

	async handleMessage (data) {
		const {user, message: messageData, channelID} = Mixer.parseMessage(data);
		const message = messageData.text;

		const channelData = sb.Channel.get(channelID);
		if (!channelData || channelData.Mode === "Inactive") {
			return;
		}

		const userData = await sb.User.get(user.name, false);
		if (!userData) {
			return;
		}
		else if (!userData.Mixer_ID) {
			await userData.saveProperty("Mixer_ID", user.id);
		}

		sb.Logger.push(message, userData, channelData);

		// If channel is read-only, do not proceed with any processing
		// Such as custom codes, un-AFK, reminders, commands (...)
		if (channelData.Mode === "Read") {
			return;
		}

		if (channelData.Custom_Code) {
			channelData.Custom_Code({
				type: "message",
				user: userData,
				channel: channelData,
				message
			});
		}

		sb.AwayFromKeyboard.checkActive(userData, channelData);
		sb.Reminder.checkActive(userData, channelData);

		// Mirror messages to a linked channel, if the channel has one
		if (channelData.Mirror) {
			this.mirror(message, userData, channelData);
		}

		// Own message - skip
		if (userData.Name === this.name) {
			return;
		}

		sb.Master.globalMessageListener(this.platform, channelData, userData, message);

		// Check and execute command if necessary
		if (message.startsWith(sb.Config.get("COMMAND_PREFIX"))) {
			const [command, ...args] = message.replace(/^\$\s*/, "$").split(" ");
			this.handleCommand(
				command,
				userData,
				channelData,
				args,
				{}
			);
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
	async handleCommand (command, userData, channelData, args = [], options = {}) {
		const execution = await sb.Command.checkAndExecute(command, args, channelData, userData, {
			platform: this.platform,
			...options
		});

		if (!execution || !execution.reply) {
			return;
		}

		if (channelData.Mirror) {
			this.mirror(execution.reply, userData,channelData, true);
		}

		const message = await sb.Master.prepareMessage(execution.reply, channelData, { skipBanphrases: true });
		if (execution.replyWithPrivateMessage) {
			console.warn("@TODO! Whispers on Mixer?", arguments);
			// @todo - whispers on mixer
		}
		else if (message) {
			this.send(message, channelData);
		}
	}

	mirror (message, userData, channelData, commandUsed = false) {
		const fixedMessage = (commandUsed)
			? `${this.platform.Mirror_Identifier} ${message}`
			: `${this.platform.Mirror_Identifier} ${userData.Name}: ${message}`;

		sb.Master.mirror(fixedMessage, userData, channelData.Mirror);
	}

	destroy () {
		// this.client && this.client.destroy();
		// this.client = null;
	}

	restart () {
		// this.parent.reloadClientModule(this.platform, false);
		// this.destroy();
	}

	static parseMessage (messageObject) {
		return {
			user: {
				id: String(messageObject.user_id),
				name: messageObject.user_name,
				level: messageObject.user_roles
			},
			message: {
				id: String(messageObject.id),
				text: messageObject.message.message[0].text,
				type: messageObject.message.message[0].type,
				data: messageObject.message.message[0].data
			},
			channelID: String(messageObject.channel)
		};
	}
};