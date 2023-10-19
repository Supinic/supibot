import { Platform } from "../platform";

declare interface IrcData {
	url: string;
	port: number;
	secure: boolean;
}

export declare class IrcPlatform extends Platform {
	readonly Defaults: Partial<IrcPlatform["Data"]>;
	readonly Data: IrcData;
}
