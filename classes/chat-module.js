/**
 * Represents a custom hook-like function that gets invoked every time a specified event
 * is emitted in a given channel.
 * @memberof sb
 */
module.exports = class ChatModule extends require("./template.js") {
	// <editor-fold defaultstate="collapsed" desc="=== INSTANCE PROPERTIES ===">

	/** @deprecated */
	ID;
	Name;
	/** @type {ChatModuleEvent[]} */
	Events;
	Active = true;
	Code;
	Global; // @todo refactor out into attachment table
	Platform; // @todo refactor out into attachment table
	attachmentReferences = [];
	data = {};

	// </editor-fold>

	/** @type {ChatModule[]} */
	static data = [];

	constructor (data) {
		super();

		this.Name = data.Name;

		this.Events = data.Events;
		if (!Array.isArray(this.Events)) {
			console.warn("Chat module has invalid events - not Array");
			this.Events = [];
		}

		this.Code = data.Code;
		this.Global = Boolean(data.Global);
		this.Platform = (data.Platform) ? sb.Platform.get(data.Platform) : null;
	}

	#initialize (attachmentData) {
		if (this.Global) {
			if (this.attachmentReferences.length !== 0) {
				return;
			}

			if (this.Platform) {
				this.attach({
					platform: this.Platform.ID
				});
			}
			else {
				this.attach({
					platform: sb.Platform.data
				});
			}

			return;
		}

		for (const data of attachmentData) {
			if (data.Chat_Module !== this.Name) {
				continue;
			}

			const args = ChatModule.parseModuleArgs(data.Args);
			if (!args) {
				console.warn("Reattaching module failed", {
					module: this.Name,
					channel: data.Channel
				});

				continue;
			}

			this.attach({
				args,
				channel: sb.Channel.get(data.Channel)
			});
		}

		return this;
	}

	attach (options) {
		if (!options.args) {
			options.args = [];
		}

		for (const event of this.Events) {
			for (const channelData of ChatModule.getTargets(options)) {
				const reference = this.attachmentReferences.find(i => i.channelID === channelData.ID);
				if (reference) {
					channelData.events.on(event, reference.listener);
					reference.active = true;
				}
				else {
					const listener = (function chatModuleBinding (context) {
						if (typeof this.Code !== "function") {
							console.warn("Destroyed chat module's code invoked! Module was automatically detached", { context, chatModule: this });
							channelData.events.off(event, listener);
							return;
						}

						this.Code(context, ...options.args);
					}).bind(this);

					channelData.events.on(event, listener);

					this.attachmentReferences.push({
						channelID: channelData.ID,
						active: true,
						listener
					});
				}
			}
		}
	}

	/**
	 * Detaches the module instance from all channels determined by options.
	 * @param {Object} options
	 * @param {boolean} [options.remove] If true, the module reference will be removed instead of deactivated.
	 * @param {sb.Platform} [options.platform] Specified attachment platform
	 * @param {sb.Channel|sb.Channel[]} [options.channel] Specified attachment channels	 *
	 */
	detach (options) {
		for (const event of this.Events) {
			for (const channelData of ChatModule.getTargets(options)) {
				const index = this.attachmentReferences.findIndex(i => i.channelID === channelData.ID);
				if (index === -1) {
					continue;
				}

				const reference = this.attachmentReferences[index];
				channelData.events.off(event, reference.listener);

				if (options.remove) {
					reference.listener = null;
					this.attachmentReferences.splice(index, 1);
				}
				else {
					reference.active = false;
				}
			}
		}
	}

	detachAll (hard = false) {
		const channels = this.attachmentReferences
			.map(i => sb.Channel.get(i.channelID))
			.filter(Boolean);

		this.detach({
			channel: channels,
			remove: Boolean(hard)
		});
	}

	destroy () {
		this.detachAll(true);

		this.data = null;
		this.attachmentReferences = null;

		this.Events = null;
		this.Code = null;
	}

	static getTargets (options) {
		const result = [];
		if (options.channel) {
			if (Array.isArray(options.channel)) {
				result.push(...options.channel);
			}
			else {
				result.push(options.channel);
			}
		}

		if (options.platform) {
			if (Array.isArray(options.platform)) {
				result.push(...options.platform.flatMap(i => sb.Channel.getJoinableForPlatform(i)));
			}
			else {
				result.push(...sb.Channel.getJoinableForPlatform(options.platform));
			}
		}

		return result;
	}

	static get (identifier) {
		if (identifier instanceof ChatModule) {
			return identifier;
		}
		else if (typeof identifier === "string") {
			const target = ChatModule.data.find(i => i.Name === identifier);
			return target ?? null;
		}
		else {
			throw new sb.Error({
				message: "Invalid chat module identifier type",
				args: { id: identifier, type: typeof identifier }
			});
		}
	}

	static async loadData () {
		const hasConnectorTable = await sb.Query.isTablePresent("chat_data", "Channel_Chat_Module");
		if (!hasConnectorTable) {
			console.warn("Cannot load Chat_Module", {
				reason: "missing-tables",
				tables: "Channel_Chat_Module"
			});

			return;
		}

		const { definitions } = await require("supibot-package-manager/chat-modules");
		const attachmentData = await ChatModule.#fetch();

		for (const definition of definitions) {
			const chatModule = new ChatModule(definition);
			ChatModule.data.push(chatModule);

			const moduleAttachmentData = attachmentData.filter(i => i.Chat_Module === chatModule.Name);
			if (moduleAttachmentData.length !== 0) {
				chatModule.#initialize(moduleAttachmentData);
			}
		}
	}

	static async reloadData () {
		for (const chatModule of ChatModule.data) {
			chatModule.destroy();
		}

		await super.reloadData();
	}

	static async reloadSpecific (...list) {
		if (list.length === 0) {
			return false;
		}

		const hasConnectorTable = await sb.Query.isTablePresent("chat_data", "Channel_Chat_Module");
		if (!hasConnectorTable) {
			console.warn("Cannot load Chat_Module", {
				reason: "missing-tables",
				tables: "Channel_Chat_Module"
			});

			return {
				success: false,
				reason: "no-attachment-table",
				failed: []
			};
		}

		const failed = [];
		const existingModules = list.map(i => ChatModule.get(i)).filter(Boolean);

		const chatModulePath = require.resolve("supibot-package-manager/chat-module/");
		delete require.cache[chatModulePath];

		for (const originalChatModule of existingModules) {
			const index = ChatModule.data.indexOf(originalChatModule);
			const identifier = originalChatModule.Name;

			originalChatModule.destroy();

			if (index !== -1) {
				ChatModule.data.splice(index, 1);
			}

			let path;
			try {
				path = require.resolve(`supibot-package-manager/chat-module/${identifier}`);
				delete require.cache[path];
			}
			catch {
				failed.push({
					identifier,
					reason: "no-path"
				});
			}
		}

		const { definitions } = await require("supibot-package-manager/chat-modules");
		const attachmentData = await ChatModule.#fetch(list);

		for (const definition of definitions) {
			const chatModule = new ChatModule(definition);
			ChatModule.data.push(chatModule);

			const moduleAttachmentData = attachmentData.filter(i => i.Chat_Module === chatModule.Name);
			if (moduleAttachmentData.length !== 0) {
				chatModule.#initialize(moduleAttachmentData);
			}
		}

		return {
			success: true,
			failed
		};
	}

	static getChannelModules (channel) {
		const channelData = sb.Channel.get(channel);
		const modules = [];

		for (const module of ChatModule.data) {
			const hasChannel = module.attachmentReferences.find(i => i.channelID === channelData.ID);
			if (hasChannel) {
				modules.push(module);
			}
		}

		return modules;
	}

	static detachChannelModules (channel, options = {}) {
		const channelData = sb.Channel.get(channel);
		const detachedModules = ChatModule.getChannelModules(channelData);
		for (const module of detachedModules) {
			module.detach({
				channel: channelData,
				remove: Boolean(options.remove)
			});
		}
	}

	static attachChannelModules (channel) {
		const channelData = sb.Channel.get(channel);
		const detachedModules = ChatModule.getChannelModules(channelData);
		for (const module of detachedModules) {
			module.attach({
				channel: channelData
			});
		}
	}

	static async reloadChannelModules (channel) {
		const channelData = sb.Channel.get(channel);
		ChatModule.detachChannelModules(channelData, { remove: true });

		const attachmentData = await sb.Query.getRecordset(rs => rs
			.select("Chat_Module", "Specific_Arguments AS Args")
			.from("chat_data", "Channel_Chat_Module")
			.where("Channel = %n", channelData.ID)
		);

		for (const attachment of attachmentData) {
			const module = ChatModule.get(attachment.Chat_Module);
			if (!module) {
				throw new sb.Error({
					message: "New module detected - cannot reload channel modules",
					args: { module: attachment.Chat_Module }
				});
			}

			const args = ChatModule.parseModuleArgs(attachment.Args);
			if (!args) {
				console.warn("Reattaching module failed", {
					module: module.Name,
					channel: channelData.ID
				});
				continue;
			}

			module.attach({
				args,
				channel: channelData
			});
		}
	}

	static parseModuleArgs (rawArgs) {
		let args = [];
		if (rawArgs !== null) {
			try {
				args = eval(rawArgs);
			}
			catch (e) {
				console.warn(e);
				return null;
			}
		}

		if (!Array.isArray(args)) {
			console.warn("Invalid chat module arguments type", args);
			return null;
		}

		return args;
	}

	static async #fetch (specificNames) {
		return await sb.Query.getRecordset(rs => {
			rs.select("Channel", "Chat_Module", "Specific_Arguments as Args")
				.from("chat_data", "Channel_Chat_Module");

			if (typeof specificNames === "string") {
				rs.where("Chat_Module = %s", specificNames);
			}
			else if (Array.isArray(specificNames)) {
				rs.where("Chat_Module IN %s+", specificNames);
			}

			return rs;
		});
	}

	static destroy () {
		for (const chatModule of ChatModule.data) {
			chatModule.destroy();
		}

		super.destroy();
	}
};

/**
 * @typedef {"message"|"online"|"offline"|"raid"|"subscription"} ChatModuleEvent
 */
