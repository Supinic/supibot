import * as z from "zod";

export const ALLOWED_PLATFORM_TYPES = ["twitch", "discord", "cytube", "irc"] as const;
export const BasePlatformConfigSchema = z.object({
	ID: z.int().positive(),
	host: z.string().nullable().optional(),
	messageLimit: z.int().positive(),
	selfName: z.string(),
	selfId: z.string().nullable(),
	active: z.boolean(),
	mirrorIdentifier: z.string().nullable().optional(),
	platform: z.unknown(),
	logging: z.unknown()
});
