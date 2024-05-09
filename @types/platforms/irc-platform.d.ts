import { Platform } from "./template";

declare type IrcData = {
	url: string;
	port: number;
	secure: boolean;
};

export declare class IrcPlatform extends Platform {
	readonly config: IrcData;
}
