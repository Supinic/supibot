import { Log, Platform } from "../platform";

declare interface CytubeData {
	messageDelayThreshold: boolean;
}
declare interface CytubeLog extends Log {
	videoRequests: boolean;
}

export declare class CytubePlatform extends Platform {
	readonly Log: CytubeLog;
	readonly Defaults: Partial<CytubePlatform["Data"]>;
	readonly Data: CytubeData;
}
