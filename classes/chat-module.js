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
	Events;
	Active = true;
	Code;
	attachmentReferences = [];
	data = {};

	//</editor-fold>

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
					const listener = (context) => this.Code(context, ...options.args);
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
				const reference = this.attachmentReferences.find(i => i.channelID === channelData.ID);
				if (!reference) {
					continue;
				}

				reference.active = false;
				channelData.events.off(event, reference.listener);
			}
		}
	}

	detachAll () {
		for (const target of this.attachmentReferences) {
			this.detach({
				channel: target.ID
			});
		}
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

		const data = await sb.Query.getRecordset(rs => rs
			.select("Chat_Module.ID AS Module_ID")
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
			})
		);

		for (const row of data) {
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
				let args = [];
				if (channelItem.Args !== null) {
					try {
						args = JSON.parse(channelItem.Args);
					}
					catch (e) {
						console.warn("Chat module has invalid args for channel", { moduleID: row.ID, channelItem });
						continue;
					}
				}

				if (!Array.isArray(args)) {
					console.warn("Chat module has non-Array args for channel", { moduleID: row.ID, channelItem });
					continue;
				}

				chatModule.attach({
					args,
					channel: sb.Channel.get(channelItem.ID)
				});
			}

			ChatModule.data.push(chatModule);
		}
	}

	static async reloadData () {
		for (const chatModule of ChatModule.data) {
			chatModule.detachAll();
		}

		super.reloadData();
	}

	static getChannelModules (channel) {
		const channelData = sb.Channel.get(channel);
		const modules = [];

		for (const module of ChatModule.data) {
			const hasChannel = module.attachmentReferences.filter(i => i.channelID === channelData.ID);
			if (hasChannel) {
				modules.push(module);
			}
		}

		return modules;
	}

	static detachChannelModules (channel) {
		const channelData = sb.Channel.get(channel);
		const detachedModules = ChatModule.getChannelModules(channelData);
		for (const module of detachedModules) {
			module.detach({
				channel: channelData
			});
		}
	}

	static destroy () {
		for (const chatModule of ChatModule.data) {
			chatModule.detachAll();
		}

		super.destroy();
	}
};