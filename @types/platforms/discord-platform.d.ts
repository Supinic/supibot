import { Platform } from "./template";

declare type DiscordData = {
	sendVerificationChallenge: boolean;
	createReminderWhenSendingPrivateMessageFails: boolean;
};

export declare class DiscordPlatform extends Platform {
	readonly config: DiscordData;
}
