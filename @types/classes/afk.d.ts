import { ClassTemplate } from "./template";
import { CustomDate } from "../objects/date";
import { Channel } from "./channel";
import { User } from "./user";

export declare type Status = "afk" | "poop" | "gn" | "brb" | "shower" | "lurk" | "food" | "work" | "ppPoof" | "study";
export declare type Like = number | AwayFromKeyboard;

declare type ConstructorData = {
	ID: number;
	User_Alias: User["ID"];
	Started: CustomDate;
	Text: string;
	Silent: boolean;
	Status: Status;
};

declare type SetData = Omit<ConstructorData, "ID"> & {
	/** If true, the AFK status is extending a previous one. */
	extended?: boolean;
};

/**
 * Represents a user's AFK status.
 */
export declare class AwayFromKeyboard extends ClassTemplate {
	static readonly data: Map<number, AwayFromKeyboard>;

	/**
	 * Reloads a specific list of AFK statuses, provided as identifiers.
	 */
	static reloadSpecific (...list: AwayFromKeyboard["ID"][]): Promise<boolean>;

	/**
	 * Checks if a user is AFK.
	 * If they are, returns their AFK data and unsets the AFK status.
	 * If the status is set as not silent, also sends a message to the given channel.
	 */
	static checkActive (userData: User, channelData: Channel): Promise<void>;

	/**
	 * Returns an AFK status object based on the AFK status's ID, or by the user object.
	 */
	static get (identifier: Like | User): AwayFromKeyboard | null;

	/**
	 * Sets a user's AFK status and creates a database row representing it.
	 */
	static set (userData: User, data: SetData): Promise<void>;

	/**
	 * Unique identifier
	 */
	readonly ID: number

	/**
	 * Unique numeric user identifier
	 */
	readonly User_Alias: User["ID"];

	/**
	 * The timestamp of when the AFK status was set up
	 */
	readonly Started: CustomDate;

	/**
	 * AFK status description
	 */
	readonly Text: string;

	/**
	 * If true, the AFK status will not be broadcast when the user comes back from being AFK
	 * @type {boolean}
	 */
	readonly Silent: boolean;

	/**
	 * Determines the sort of "action" the user was doing while being AFK.
	 * E.g. "no longer AFK", "no longer taking a shower", ...
	 * This is used for determining the message sent.
	 */
	readonly Status: Status;

	constructor (data: ConstructorData);
}
