import { Platform } from "./template";

declare type CytubeData = {
	messageDelayThreshold: boolean;
};

export declare class CytubePlatform extends Platform {
	readonly config: CytubeData;
}
