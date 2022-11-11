import { ClassTemplate } from "./template";
import { Channel, Like as ChannelLike } from "./channel";
import { Like as PlatformLike, Platform } from "./platform";
import { User } from "./user";
import { JSONifiable, Message, SimpleGenericData, XOR } from "../globals";

declare type ConstructorData = {
	Name: string;
	Events: string | string[]; // JSON-compliant string[] or string[] directly
	Active?: boolean;
	Code: string; // string that can be eval() and results in a function
};
declare type PlatformOption = {
	platform: PlatformLike | PlatformLike[];
}
declare type ChannelOption = {
	channel: ChannelLike | ChannelLike[];
}
declare type AttachOptions = XOR<PlatformOption, ChannelOption>;
declare type DetachOptions = AttachOptions & {
	remove: boolean;
};

export declare type Event = "message" | "online" | "offline" | "raid" | "subscription";
export declare type Argument = SimpleGenericData;
export declare type AttachmentReference = {
	channelID: Channel["ID"];
	active: boolean;
	listener: (context: Context, ...args: Argument[]) => void;
};
export declare type Context = {
	channel: Channel;
	data: SimpleGenericData;
	event: Event;
	specificArguments: Argument[];
	message?: Message | null;
	user?: User | null;
};
export declare type Descriptor = {
	Channel: Channel["ID"];
	Chat_Module: ChatModule["Name"];
	Args: string | null;
};
export declare type Like = number | string | ChatModule;

/**
 * Represents a custom hook-like function that gets invoked every time a specified event
 * is emitted in a given channel.
 */
export declare class ChatModule extends ClassTemplate {
	static readonly data: ChatModule[];

	static #fetch (specificNames: string | string[]): Promise<Descriptor[]>;
	static get (identifier: Like): ChatModule | null;

	/**
	 * Reloads a specific list of chat modules, provided as identifiers or instances.
	 */
	static reloadSpecific (...list: Like[]): Promise<boolean>;
	/**
	 * Helper method - flattens out the provided channel array, and fetches a list of all channels
	 * if a platform (or multiple) is provided.
	 */
	static getTargets (options: AttachOptions): Channel[];

	/**
	 * Returns a list of chat modules that are currently present in a given channel instance.
	 */
	static getChannelModules (channel: ChannelLike): ChatModule[];

	/**
	 * Attaches all currently loaded chat modules to a given channel instance.
	 */
	static attachChannelModules (channel: ChannelLike): void;

	/**
	 * Detaches all currently active chat modules from a given channel intsance.
	 */
	static detachChannelModules (channel: ChannelLike, options: DetachOptions): void;

	/**
	 * Detaches all chat modules from a given channel instance, reloads their definitions, and re-attaches them right back.
	 * Thus essentially performing a reload.
	 */
	static reloadChannelModules (channel: ChannelLike): Promise<void>;

	/**
	 * Parses provided chat module arguments from string to an array of argument values.
	 */
	static parseModuleArgs (rawArgs: string): Argument[];
	static destroy (): void;

	readonly Name: string;
	readonly Events: Event[];
	readonly Active: boolean;
	readonly Global: boolean;
	readonly Platform: Platform | null;
	readonly Code: (context: Context, ...args: Argument[]) => void;
	readonly attachmentReferences: AttachmentReference[];
	readonly data: Record<string, JSONifiable>;

	constructor (data: ConstructorData);

	#initialize (attachmentData: Descriptor[]): void;

	/**
	 * Attaches the module instance to a provided platform(s) or channel(s).
	 */
	attach (options: AttachOptions): void;

	/**
	 * Detaches the module instance from all channels determined by options.
	 * @param options
	 * @param options.remove If true, the module reference will be removed instead of deactivated.
	 * @param options.platform Specified attachment platform
	 * @param options.channel Specified attachment channels
	 */
	detach (options: DetachOptions): void;

	/**
	 * Detaches the module instance from all channels without specifying any parameters.
	 * @param hard If `true`, the reference will be removed and the listener nullified.
	 * If not, the reference is simply marked as inactive.
	 */
	detachAll (hard?: boolean): void;
	destroy (): void;
}
