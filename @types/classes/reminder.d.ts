import { Date as CoreDate } from "supi-core";
import { Counter, Gauge } from "prom-client";

import { ClassTemplate } from "./template";
import { Channel } from "./channel";
import { Platform, Like as PlatformLike } from "../platforms/template";
import { User } from "./user";

type ConstructorData = {
	ID: number;
	Active: boolean;
	User_From: User["ID"];
	User_To: User["ID"];
	Channel: Channel["ID"];
	Text: string | null;
	Created: CoreDate;
	Schedule: CoreDate | null;
	Private_Message: boolean;
	Platform: PlatformLike;
	Type: Type;
};

type OmittableConstructorData = {
	User_From: ConstructorData["User_From"];
	User_To: ConstructorData["User_To"];
	Platform: ConstructorData["Platform"];

	Channel?: ConstructorData["Channel"];
	Text?: ConstructorData["Text"];
	Schedule?: ConstructorData["Schedule"];
	Private_Message?: ConstructorData["Private_Message"];
	Type?: ConstructorData["Type"];
};

type Result = {
	success: boolean;
	cause?: string | null;
	ID?: Reminder["ID"];
};
type RemoveOptions = {
	permanent: boolean;
	cancelled: boolean;
};
type Type = "Reminder" | "Pingme" | "Deferred";

export declare type Like = number | Reminder;

export declare class Reminder extends ClassTemplate {
	static data: Map<User["ID"], Reminder[]>;
	static available: Map<Reminder["ID"], User["ID"]>;
	static readonly mandatoryConstructorOptions: (keyof ConstructorData)[];

	static #add (reminder: Reminder): void;
	static #remove (ID: Reminder["ID"], options: RemoveOptions): Promise<boolean>;

	static #activeGauge: Gauge;
	static #limitRejectedCounter: Counter;
	static #totalCounter: Counter;

	/**
	 * Reloads a specific list of reminders, provided as identifiers or instances.
	 */
	static reloadSpecific (...list: Like[]): Promise<boolean>;
	static get (identifier: Like): Reminder | null;
	static create (data: OmittableConstructorData, skipChecks?: boolean): Promise<Result>;
	static checkActive (targetUserData: User, channelData: Channel): Promise<void>;
	static checkLimits (userFrom: number, userTo: number, schedule?: CoreDate, type?: string): Promise<Result>;
	static createRelayLink (endpoint: string, params: string): Promise<string>;
	static clear (): void;
	static destroy (): void;

	readonly ID: number;
	readonly Active: boolean;
	readonly User_From: User["ID"];
	readonly User_To: User["ID"];
	readonly Channel: Channel["ID"] | null;
	readonly Text: string | null;
	readonly Created: CoreDate;
	readonly Schedule: CoreDate | null;
	readonly Private_Message: boolean;
	readonly Platform: Platform | null;
	readonly Type: Type;

	private timeout: NodeJS.Timeout | null;

	constructor (data: ConstructorData);

	activateTimeout (): Reminder;
	deactivate (permanent: boolean, cancelled: boolean): Promise<Reminder>;
	destroy (): void;
}
