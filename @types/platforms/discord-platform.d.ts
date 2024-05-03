import { Platform } from "./template";

declare interface DiscordData {
	sendVerificationChallenge: boolean;
	createReminderWhenSendingPrivateMessageFails: boolean;
}

export declare class DiscordPlatform extends Platform {
	readonly Defaults: Partial<DiscordPlatform["Data"]>;
	readonly Data: DiscordData;
}
