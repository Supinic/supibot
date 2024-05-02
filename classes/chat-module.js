const Channel = require("./channel.js");
const Platform = require("../platforms/template.js");

module.exports = class ChatModule extends require("./template.js") {
	static importable = true;
	static uniqueIdentifier = "Name";

	Name;
	Events;
	Active = true;
	Code;
	Global; // @todo refactor out into attachment table
	Platform; // @todo refactor out into attachment table
	attachmentReferences = [];
	data = {};

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
		this.Platform = (data.Platform) ? Platform.get(data.Platform) : null;
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
					platform: Platform.list
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
				channel: Channel.get(data.Channel)
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
			.map(i => Channel.get(i.channelID))
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
				result.push(...options.platform.flatMap(i => Channel.getJoinableForPlatform(i)));
			}
			else {
				result.push(...Channel.getJoinableForPlatform(options.platform));
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

	static async initialize () {
		// Override default behaviour of automatically loading module's data on initialization
		return this;
	}

	static async importData (definitions) {
		const hasConnectorTable = await sb.Query.isTablePresent("chat_data", "Channel_Chat_Module");
		if (!hasConnectorTable) {
			console.warn("Cannot load Chat_Module", {
				reason: "missing-tables",
				tables: "Channel_Chat_Module"
			});

			return;
		}

		const attachmentData = await ChatModule.#fetch();

		for (const definition of definitions) {
			const chatModule = new ChatModule(definition);
			ChatModule.data.push(chatModule);

			const moduleAttachmentData = attachmentData.filter(i => i.Chat_Module === chatModule.Name);
			chatModule.#initialize(moduleAttachmentData);
		}
	}

	static async importSpecific (...definitions) {
		if (definitions.length === 0) {
			return;
		}

		const hasConnectorTable = await sb.Query.isTablePresent("chat_data", "Channel_Chat_Module");
		if (!hasConnectorTable) {
			throw new sb.Error({
				message: "Cannot import chat module(s), attachment table is missing"
			});
		}

		const attachmentData = await ChatModule.#fetch(definitions.map(i => i.Name));
		const newInstances = super.genericImportSpecific(...definitions);

		for (const instance of newInstances) {
			const moduleAttachmentData = attachmentData.filter(i => i.Chat_Module === instance.Name);
			instance.#initialize(moduleAttachmentData);
		}
	}

	static getChannelModules (channel) {
		const channelData = Channel.get(channel);
		const modules = [];

		for (const module of ChatModule.data) {
			const hasChannel = module.attachmentReferences.find(i => i.channelID === channelData.ID);
			if (hasChannel) {
				modules.push(module);
			}
		}

		return modules;
	}

	static detachChannelModules (channelData, options = {}) {
		const detachedModules = ChatModule.getChannelModules(channelData);
		for (const module of detachedModules) {
			module.detach({
				channel: channelData,
				remove: Boolean(options.remove)
			});
		}
	}

	static attachChannelModules (channelData) {
		const detachedModules = ChatModule.getChannelModules(channelData);
		for (const module of detachedModules) {
			module.attach({
				channel: channelData
			});
		}
	}

	static async reloadChannelModules (channel) {
		const channelData = Channel.get(channel);
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
