import { ClassTemplate } from "./template";
import { CustomDate as Date } from "../objects/date";
import { Channel } from "./channel";
import { User } from "./user";

export declare type Status = "afk" | "poop" | "gn" | "brb" | "shower" | "lurk" | "food" | "work" | "ppPoof" | "study";
export declare type Like = number | AwayFromKeyboard;

declare type ConstructorData = {
	ID: number;
	User_Alias: User["ID"];
	Started: Date;
	Text: string;
	Silent: boolean;
	Status: Status;
	extended?: boolean;
};

export declare class AwayFromKeyboard extends ClassTemplate {
	static readonly data: Map<string, AwayFromKeyboard>;

	static checkActive (userData: User, channelData: Channel): Promise<void>;
	static get (identifier: Like | User): AwayFromKeyboard | null;
	static set (userData: User, data: ConstructorData): Promise<void>;

	readonly ID: number;
	readonly User_Alias: User["ID"];
	readonly Started: Date;
	readonly Text: string;
	readonly Silent: boolean;
	readonly Status: Status;
	readonly extended: boolean;

	constructor (data: ConstructorData);
}
