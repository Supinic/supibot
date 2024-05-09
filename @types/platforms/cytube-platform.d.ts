import { Log, Platform } from "./template";

declare type CytubeData = {
	messageDelayThreshold: boolean;
};

declare interface CytubeLog extends Log {
	videoRequests: boolean;
}

export declare class CytubePlatform extends Platform {
	readonly log: CytubeLog;
	readonly config: CytubeData;
}
