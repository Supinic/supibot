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

export declare class ChatModule extends ClassTemplate {
	static readonly data: ChatModule[];

	static #fetch (specificNames: string | string[]): Promise<Descriptor[]>;
	static get (identifier: Like): ChatModule | null;
	static getTargets (options: AttachOptions): Channel[];
	static getChannelModules (channel: ChannelLike): ChatModule[];
	static attachChannelModules (channel: ChannelLike): void;
	static detachChannelModules (channel: ChannelLike, options: DetachOptions): void;
	static reloadChannelModules (channel: ChannelLike): Promise<void>;
	static parseModuleArgs (rawArgs: string): Argument[];
	static destroy (): void;

	readonly Name: string;
	readonly Events: Event[];
	readonly Global: boolean;
	readonly Platform: Platform | null;
	readonly Code: (context: Context, ...args: Argument[]) => void;
	readonly attachmentReferences: AttachmentReference[];
	readonly data: Record<string, JSONifiable>;

	constructor (data: ConstructorData);

	#initialize (attachmentData: Descriptor[]): void;
	attach (options: AttachOptions): void;
	detach (options: DetachOptions): void;
	detachAll (hard?: boolean): void;
	destroy (): void;
}
