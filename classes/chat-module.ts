import { SupiError, type Recordset } from "supi-core";

import { TemplateWithoutId } from "./template.js";
import { Channel, Like as ChannelLike } from "./channel.js";
import { User } from "./user.js";

import { Platform } from "../platforms/template.js";
import type { Message, SimpleGenericData, XOR } from "../@types/globals.d.ts";

export type ChatModuleDefinition = Pick<ChatModule, "Name" | "Events" | "Global" | "Code"> & {
	Platform: Platform["ID"] | null;
};

export type Event = "message" | "online" | "offline" | "raid" | "subscription";
export type Argument = SimpleGenericData;
export type AttachmentReference = {
	channelID: Channel["ID"];
	active: boolean;
	listener: (context: ModuleContext, ...args: Argument[]) => void;
};
export type ModuleContext = {
	channel: Channel;
	data: SimpleGenericData;
	event: Event;
	specificArguments: Argument[];
	message?: Message | null;
	user?: User | null;
};
export type Descriptor = {
	Channel: Channel["ID"];
	Chat_Module: ChatModule["Name"];
	Args: string | null;
};
export type Like = number | string | ChatModule;

type PlatformLike = number | string | Platform; // @todo move to Platform
type PlatformOption = {
	platform: PlatformLike | PlatformLike[];
}
type ChannelOption = {
	channel: ChannelLike | ChannelLike[];
}
type AttachOptions = XOR<PlatformOption, ChannelOption> & { args?: SimpleGenericData[]; };
type DetachOptions = AttachOptions & {
	remove: boolean;
};

export class ChatModule extends TemplateWithoutId {
	readonly Name: string;
	readonly Events: string[];
	readonly Active: boolean = true;
	readonly Code: unknown;
	readonly Global: boolean; // @todo refactor out into attachment table
	readonly Platform: Platform | null; // @todo refactor out into attachment table

	attachmentReferences: AttachmentReference[] = [];
	data = {};

	static data: Map<ChatModule["Name"], ChatModule> = new Map();
	static importable = true;
	static uniqueIdentifier = "Name";

	constructor (data: ChatModuleDefinition) {
		super();

		this.Name = data.Name;
		this.Code = data.Code;
		this.Events = data.Events;
		this.Global = Boolean(data.Global);

		if (data.Platform) {
			const platform = Platform.get(data.Platform);
			if (!platform) {
				throw new SupiError({
					message: "Invalid Platform provided in ChatModule"
				});
			}

			this.Platform = platform;
		}
		else {
			this.Platform = null;
		}
	}

	#initialize (attachmentData: Descriptor[]) {
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
					platform: Platform.getList()
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

			const channel = Channel.get(data.Channel);
			if (!channel) {
				throw new SupiError({
					message: "Invalid Channel in ChatModule definition"
				});
			}

			this.attach({ args, channel });
		}

		return this;
	}

	attach (options: AttachOptions) {
		const args = options.args ?? [];
		for (const event of this.Events) {
			for (const channelData of ChatModule.getTargets(options)) {
				const reference = this.attachmentReferences.find(i => i.channelID === channelData.ID);
				if (reference) {
					channelData.events.on(event, reference.listener);
					reference.active = true;
				}
				else {
					const listener = (function chatModuleBinding (this: ChatModule, context: ModuleContext) {
						if (typeof this.Code !== "function") {
							console.warn("Destroyed chat module's code invoked! Module was automatically detached", { context, chatModule: this });
							channelData.events.off(event, listener);
							return;
						}

						this.Code(context, ...args);
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

	detach (options: DetachOptions) {
		for (const event of this.Events) {
			for (const channelData of ChatModule.getTargets(options)) {
				const index = this.attachmentReferences.findIndex(i => i.channelID === channelData.ID);
				if (index === -1) {
					continue;
				}

				const reference = this.attachmentReferences[index];
				channelData.events.off(event, reference.listener);

				if (options.remove) {
					this.attachmentReferences.splice(index, 1);
				}
				else {
					reference.active = false;
				}
			}
		}
	}

	detachAll (hard: boolean = false) {
		const channels = this.attachmentReferences
			.map(i => Channel.get(i.channelID))
			.filter(Boolean) as Channel[]; // Type cast due to filter(Boolean)

		this.detach({
			channel: channels,
			remove: Boolean(hard)
		});
	}

	getCacheKey (): never {
		throw new SupiError({
			message: "ChatModule module does not support `getCacheKey`"
		});
	}

	destroy () {
		this.detachAll(true);
	}

	static getTargets (options: AttachOptions): Channel[] {
		const result: Channel[] = [];
		if (options.channel) {
			if (Array.isArray(options.channel)) {
				const channels = options.channel.map(i => Channel.get(i)).filter(Boolean) as Channel[];
				result.push(...channels);
			}
			else {
				const channelData = Channel.get(options.channel);
				if (channelData) {
					result.push(channelData);
				}
			}
		}

		if (options.platform) {
			if (Array.isArray(options.platform)) {
				for (const platform of options.platform) {
					const platformChannels = Channel.getJoinableForPlatform(platform);
					result.push(...platformChannels);
				}
			}
			else {
				const platformChannels = Channel.getJoinableForPlatform(options.platform);
				result.push(...platformChannels);
			}
		}

		return result;
	}

	static get (identifier: ChatModule | ChatModule["Name"]) {
		if (identifier instanceof ChatModule) {
			return identifier;
		}
		else {
			return ChatModule.data.get(identifier) ?? null;
		}
	}

	static async initialize () {
		// Overrides default behaviour of automatically loading module's data on initialization
		return;
	}

	static async importData (definitions: ChatModuleDefinition[]) {
		const attachmentData = await ChatModule.#fetch();
		for (const definition of definitions) {
			const chatModule = new ChatModule(definition);
			ChatModule.data.set(chatModule.Name, chatModule);

			const moduleAttachmentData = attachmentData.filter(i => i.Chat_Module === chatModule.Name);
			chatModule.#initialize(moduleAttachmentData);
		}
	}

	static async importSpecific (...definitions: ChatModuleDefinition[]): Promise<ChatModule[]> {
		if (definitions.length === 0) {
			return [];
		}

		const hasConnectorTable = await sb.Query.isTablePresent("chat_data", "Channel_Chat_Module");
		if (!hasConnectorTable) {
			throw new SupiError({
				message: "Cannot import chat module(s), attachment table is missing"
			});
		}

		const attachmentData = await ChatModule.#fetch(definitions.map(i => i.Name));
		if (definitions.length === 0) {
			return [];
		}

		const newInstances: ChatModule[] = [];
		for (const definition of definitions) {
			const commandName = definition.Name;
			const previousInstance = ChatModule.get(commandName);
			if (previousInstance) {
				ChatModule.data.delete(commandName);
				previousInstance.destroy();
			}

			const currentInstance = new ChatModule(definition);
			ChatModule.data.set(commandName, currentInstance);
			newInstances.push(currentInstance);
		}

		for (const instance of newInstances) {
			const moduleAttachmentData = attachmentData.filter(i => i.Chat_Module === instance.Name);
			instance.#initialize(moduleAttachmentData);
		}

		return newInstances;
	}

	static getChannelModules (channelData: Channel) {
		const modules = [];
		for (const module of ChatModule.data.values()) {
			const hasChannel = module.attachmentReferences.find(i => i.channelID === channelData.ID);
			if (hasChannel) {
				modules.push(module);
			}
		}

		return modules;
	}

	static detachChannelModules (channelData: Channel, options: { remove?: boolean; }) {
		const detachedModules = ChatModule.getChannelModules(channelData);
		for (const module of detachedModules) {
			module.detach({
				channel: channelData,
				remove: Boolean(options.remove)
			});
		}
	}

	static attachChannelModules (channelData: Channel) {
		const detachedModules = ChatModule.getChannelModules(channelData);
		for (const module of detachedModules) {
			module.attach({
				channel: channelData
			});
		}
	}

	static async reloadChannelModules (channel: Channel) {
		const channelData = Channel.get(channel);
		if (!channelData) {
			throw new SupiError({
				message: "Invalid Channel in ChatModule"
			});
		}

		ChatModule.detachChannelModules(channelData, { remove: true });

		type PartialDescriptor = Pick<Descriptor, "Args" | "Chat_Module">;
		const attachmentData = await sb.Query.getRecordset<PartialDescriptor[]>(rs => rs
			.select("Chat_Module", "Specific_Arguments AS Args")
			.from("chat_data", "Channel_Chat_Module")
			.where("Channel = %n", channelData.ID)
		);

		for (const attachment of attachmentData) {
			const module = ChatModule.get(attachment.Chat_Module);
			if (!module) {
				throw new SupiError({
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

	static parseModuleArgs (rawArgs: string | null): Argument[] | null {
		if (rawArgs === null) {
			return [];
		}

		let args = [];
		try {
			args = eval(rawArgs);
		}
		catch (e) {
			console.warn(e);
			return null;
			}

		if (!Array.isArray(args)) {
			console.warn("Invalid chat module arguments type", args);
			return null;
		}

		return args;
	}

	static async #fetch (specificNames?: string | string[]): Promise<Descriptor[]> {
		return await await sb.Query.getRecordset<Descriptor[]>(rs => {
			rs.select("Channel", "Chat_Module", "Specific_Arguments as Args");
			rs.from("chat_data", "Channel_Chat_Module");

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
		for (const chatModule of ChatModule.data.values()) {
			chatModule.destroy();
		}
	}
}

export default ChatModule;
