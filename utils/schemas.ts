// @todo figure out where to place this file properly within the project
import * as z from "zod";

const BaseIvrUserDataSchema = z.object({
	login: z.string(),
	displayName: z.string(),
	id: z.string(),
	bio: z.string().nullable(),
	follows: z.null(),
	followers: z.number(),
	profileViewCount: z.null(),
	chatColor: z.string(),
	logo: z.string(),
	banner: z.string(),
	verifiedBot: z.null(),
	createdAt: z.string(),
	updatedAt: z.string(),
	emotePrefix: z.string().nullable(),
	roles: z.object({
		isAffiliate: z.boolean(),
		isPartner: z.boolean(),
		isStaff: z.boolean().nullable()
	}),
	badges: z.array(
		z.object({
			setID: z.string(),
			title: z.string(),
			description: z.string(),
			version: z.string()
		})
	),
	chatterCount: z.number().nullable(),
	chatSettings: z.object({
		chatDelayMs: z.number(),
		followersOnlyDurationMinutes: z.number().nullable(),
		slowModeDurationSeconds: z.number().nullable(),
		blockLinks: z.boolean(),
		isSubscribersOnlyModeEnabled: z.boolean(),
		isEmoteOnlyModeEnabled: z.boolean(),
		isFastSubsModeEnabled: z.boolean(),
		isUniqueChatModeEnabled: z.boolean(),
		requireVerifiedAccount: z.boolean(),
		rules: z.array(z.string())
	}),
	stream: z.object({
		title: z.string(),
		id: z.string(),
		createdAt: z.string(),
		type: z.union([z.literal("live"), z.literal("rerun")]),
		viewersCount: z.number(),
		game: z.object({ displayName: z.string() }).nullable()
	}).nullable(),
	lastBroadcast: z.object({
		startedAt: z.string(),
		title: z.string().nullable()
	}).nullable(),
	panels: z.array(z.object({ id: z.string() }))
});

const RegularIvrUserDataSchema = BaseIvrUserDataSchema.extend({
	banned: z.literal(false)
});

const BannedIvrUserDataSchema = BaseIvrUserDataSchema.extend({
	banned: z.literal(true),
	banReason: z.union([
		z.literal("TOS_INDEFINITE"),
		z.literal("TOS_TEMPORARY"),
		z.literal("DMCA"),
		z.literal("DEACTIVATED")
	])
});

export const ivrUserDataSchema = z.array(
	z.union([RegularIvrUserDataSchema, BannedIvrUserDataSchema])
);

export type IvrUserData = z.infer<typeof ivrUserDataSchema>;
