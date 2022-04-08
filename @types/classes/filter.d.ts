import { ClassTemplate } from "./template";
import { Channel } from "./channel";
import { Command } from "./command";
import { Platform } from "./platform";
import { Row } from "../singletons/query";
import { User } from "./user";
import { XOR } from "../globals";

declare type ConstructorData = {
	ID: number;
	User_Alias: User["ID"] | null;
	Channel: Channel["ID"] | null;
	Command: Command["Name"] | null;
	Platform: Platform["ID"] | null;
	Invocation: string | null;
	Type: Type;
	Data: Data | string | null;
	Response: Response | null;
	Reason: string | null;
	Blocked_User: User["ID"] | null;
	Active: boolean;
	Issued_By: User["ID"] | null;
};
declare type ContextOptions = {
	skipUserCheck?: boolean;
	user?: User | null;
	channel?: Channel | null;
	command?: Command | null;
	platform?: Platform | null;
	invocation?: string | null;
};
declare type UnpingContextOptions = ContextOptions & {
	string: string
};
declare type ExecuteSuccess = {
	success: true;
}
declare type ExecuteFailure = {
	success: false;
	reason: string;
	filter: Filter;
	reply: string | null;
};
declare type ExecuteResult = ExecuteSuccess | ExecuteFailure;
declare type ArgumentDescriptor = {
	index?: number;
	range?: [number, number];
	regex?: RegExp;
	string?: string;
};

export declare type ArgumentsData = {
	args: ArgumentDescriptor[];
};
export declare type CooldownData = XOR<{ multiplier: number }, { override: number }>;
export declare type Data = CooldownData | ArgumentsData;
export declare type Like = number | Filter;
export declare type Response = "None" | "Auto" | "Reason";
export declare type FlagObject = object;
export declare type Type = "Blacklist" | "Whitelist"
	| "Opt-out" | "Block" | "Unping" | "Unmention" | "Cooldown" | "Flags"
	| "Offline-only" | "Online-only" | "Arguments" | "Reminder-prevention";

export declare class Filter extends ClassTemplate {
	static get (identifier: Like): Filter | null;
	static getLocals (type: Type, options: ContextOptions): Filter[];
	static execute (options: ContextOptions): Promise<ExecuteResult>;
	static create (options: ConstructorData): Promise<Filter>;
	static getMentionStatus (options: ContextOptions): boolean;
	static applyUnping (options: UnpingContextOptions): string;
	static getCooldownModifiers (options: ContextOptions): Filter | null;
	static getFlags (options: ContextOptions): FlagObject;
	static getReminderPreventions (options: ContextOptions): Filter["User_Alias"][];
	static getReason (options: ContextOptions): string | null;

	private filterData: Data;
	readonly ID: number;
	readonly User_Alias: User["ID"] | null;
	readonly Channel: Channel["ID"] | null;
	readonly Command: Command["Name"] | null;
	readonly Platform: Platform["Name"] | null;
	readonly Invocation: string | null;
	readonly Type: Type;
	readonly Data: Data;
	readonly Response: Response;
	readonly Reason: string | null;
	readonly Blocked_User: User["ID"] | null;
	readonly Active: boolean;
	readonly Issued_By: User["ID"] | null;

	constructor (data: ConstructorData);

	applyData (data: Data): boolean | number;
	createFilterData (data: Data): void;
	toggle (): ReturnType<Row["save"]>;
	setReason (reason: Filter["Reason"]): Promise<void>;

	get priority (): number;
}
