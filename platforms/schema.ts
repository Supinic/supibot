import * as z from "zod";

export const BasePlatformConfigSchema = z.object({
	ID: z.int().positive(),
	host: z.string().nullish(),
	messageLimit: z.int().positive(),
	selfName: z.string(),
	selfId: z.string().nullable(),
	active: z.boolean(),
	mirrorIdentifier: z.string().nullish(),
	platform: z.unknown(),
	logging: z.unknown()
});
