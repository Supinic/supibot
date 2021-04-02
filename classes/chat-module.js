/**
 * Represents a custom hook-like function that gets invoked every time a specified event
 * is emitted in a given channel.
 * @memberof sb
 * @type {ChatModule}
 */
module.exports = class ChatModule extends require("./template.js") {
	//<editor-fold defaultstate="collapsed" desc="=== INSTANCE PROPERTIES ===">

	ID;
	Name;
	/** @type {ChatModuleEvent[]} */
	Events;
	Active = true;
	Code;
	attachmentReferences = [];
	data = {};

	//</editor-fold>

	/** @type {ChatModule[]} */
	static data = [];
	static #serializableProperties = {
		Name: { type: "string" },
		Events: { type: "descriptor" },
		Description: { type: "string" },
		Code: { type: "descriptor" },
		Author: { type: "string" }
	};

	constructor (data) {
		super();

		this.ID = (typeof data.ID === "number")
			? data.ID
			: Symbol();

		this.Name = data.Name;

		try {
			this.Events = JSON.parse(data.Events);
			if (!Array.isArray(this.Events)) {
				console.warn("Chat module - events are not Array", e);
				this.Events = [];
			}
		}
		catch (e) {
			console.warn("Chat module - events parse failed", e);
			this.Events = [];
		}

		if (typeof data.Active === "boolean") {
			this.Active = data.Active;
		}

		let fn;
		try {
			fn = eval(data.Code);
		}
		catch (e) {
			console.warn("Chat module - code parse failed", e);
			fn = () => undefined;
		}

		this.Code = fn.bind(this);
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
							console.warn("Attempting to run a destroyed chat module event", { context, chatModule: this.Name });
							this.detachAll(true);
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
	 * @param {Platform} [options.platform] Specified attachment platform
	 * @param {Channel|Channel[]} [options.channel] Specified attachment channels	 * 
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
		this.ID = null;
		this.Code = null;
	}
	
	async serialize (options = {}) {
		if (typeof this.ID !== "number") {
			throw new sb.Error({
				message: "Cannot serialize an anonymous ChatModule",
				args: {
					ID: this.ID,
					Name: this.Name
				}
			});
		}

		const row = await sb.Query.getRow("chat_data", "Chat_Module");
		await row.load(this.ID);

		return await super.serialize(row, ChatModule.#serializableProperties, options);
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
		else if (typeof identifier === "number" || typeof identifier === "symbol") {
			const target = ChatModule.data.find(i => i.ID === identifier);
			return target ?? null;
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
		const presentTables = await Promise.all([
			sb.Query.isTablePresent("chat_data", "Chat_Module"),
			sb.Query.isTablePresent("chat_data", "Channel_Chat_Module")
		]);

		if (presentTables.some(i => i === false)) {
			console.warn("Cannot load Chat_Module", {
				reason: "missing-tables",
				tables: ["Chat_Module", "Channel_Chat_Module"].filter((i, ind) => !presentTables[ind])
			});

			return;
		}

		const data = await ChatModule.#fetch();
		for (const row of data) {
			const chatModule = ChatModule.#create(row);
			ChatModule.data.push(chatModule);
		}
	}

	static async reloadData () {
		for (const chatModule of ChatModule.data) {
			chatModule.destroy();
		}

		super.reloadData();
	}

	static async reloadSpecific (...list) {
		if (list.length === 0) {
			return false;
		}

		const existingModules = list.map(i => ChatModule.get(i)).filter(Boolean);
		for (const chatModule of existingModules) {
			const index = ChatModule.data.findIndex(i => i === chatModule);

			chatModule.destroy();

			if (index !== -1) {
				ChatModule.data.splice(index, 1);
			}
		}

		const data = await ChatModule.#fetch(list);
		for (const row of data) {
			const chatModule = ChatModule.#create(row);
			ChatModule.data.push(chatModule);
		}

		return true;
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
					module: module.ID,
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
			rs.select("Chat_Module.ID AS Module_ID")
				.select("Chat_Module.*")
				.select("Channel.ID AS Channel_ID")
				.select("Channel_Chat_Module.Specific_Arguments AS Args")
				.from("chat_data", "Chat_Module")
				.where("Active = %b", true)
				.reference({
					left: true,
					sourceTable: "Chat_Module",
					targetTable: "Channel",
					referenceTable: "Channel_Chat_Module",
					collapseOn: "Module_ID",
					fields: ["Channel_ID", "Args"]
				});

			if (typeof specificNames === "string") {
				rs.where("Chat_Module.Name = %s", specificNames);
			}
			else if (Array.isArray(specificNames)) {
				rs.where("Chat_Module.Name IN %s+", specificNames);
			}

			return rs;
		});
	}

	static #create (row) {
		const chatModule = new ChatModule(row);
		if (row.Global) {
			if (row.Platform) {
				chatModule.attach({
					platform: row.Platform
				});
			}
			else {
				chatModule.attach({
					platform: sb.Platform.data
				});
			}
		}

		const channelItems = row.Channel.filter(i => i.ID);
		for (const channelItem of channelItems) {
			const args = ChatModule.parseModuleArgs(channelItem.Args);
			if (!args) {
				console.warn("Reattaching module failed", {
					module: chatModule.ID,
					channel: channelItem.ID
				});
				continue;
			}

			chatModule.attach({
				args,
				channel: sb.Channel.get(channelItem.ID)
			});
		}

		return chatModule;
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
