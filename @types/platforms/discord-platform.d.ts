import { Platform } from "./template";

declare type DiscordData = {
	sendVerificationChallenge: boolean;
};

export declare class DiscordPlatform extends Platform {
	readonly config: DiscordData;
}
