// @todo figure out where to place this file properly within the project
import * as z from "zod";

export const twitchIdentitySchema = z.object({
	access_token: z.string(),
	refresh_token: z.string()
});

export const twitchSubscriberSchema = z.object({
	data: z.array(z.object({
		broadcaster_id: z.string(),
		broadcaster_login: z.string(),
		broadcaster_name: z.string(),
		gifter_id: z.string(),
		gifter_login: z.string(),
		gifter_name: z.string(),
		is_gift: z.boolean(),
		plan_name: z.string(),
		user_id: z.string(),
		user_name: z.string(),
		user_login: z.string(),
		tier: z.union([
			z.literal("1000"),
			z.literal("2000"),
			z.literal("3000")
		])
	}))
});

export type TwitchSubscriberData = z.infer<typeof twitchSubscriberSchema>["data"];

export const twitchStreamSchema = z.object({
	data: z.array(z.object({
		id: z.string(),
		user_id: z.string(),
		user_login: z.string(),
		user_name: z.string(),
		game_id: z.string(),
		game_name: z.string(),
		type: z.enum(["live", ""]),
		title: z.string(),
		tags: z.array(z.string()),
		viewer_count: z.int().min(0),
		started_at: z.iso.datetime(),
		language: z.string(),
		thumbnail_url: z.string(),
		/**
		 * Despite what Twitch's Helix API documentation says, this field can be `true`.
		 * Disregard this (Helix API docs): `IMPORTANT This field is deprecated and returns only false.`
		 */
		is_mature: z.boolean()
	}))
});

export const twitchChannelSchema = z.array(z.object({
	broadcaster_id: z.string(),
	broadcaster_language: z.string(),
	broadcaster_login: z.string(),
	broadcaster_name: z.string(),
	content_classification_labels: z.array(z.unknown()),
	delay: z.int(),
	game_id: z.string(),
	game_name: z.string(),
	is_branded_content: z.boolean(),
	tags: z.array(z.string()),
	title: z.string()
}));

export const twitchScheduleSchema = z.object({
	data: z.object({
		broadcaster_id: z.string(),
		broadcaster_language: z.string().optional(),
		broadcaster_name: z.string(),
		segments: z.array(z.object({
			id: z.string(),
			start_time: z.iso.datetime(),
			end_time: z.iso.datetime().nullable(),
			title: z.string(),
			canceled_until: z.iso.datetime().nullable(),
			is_recurring: z.boolean(),
			category: z.object({
				id: z.string(),
				name: z.string()
			}).nullable()
		})).optional(),
		vacation: z.object({
			start_time: z.iso.datetime(),
			end_time: z.iso.datetime()
		}).nullable()
	})
});

export const ivrErrorSchema = z.object({
	statusCode: z.int().min(400).max(599),
	error: z.object({
		message: z.string()
	})
});

const BaseIvrUserDataSchema = z.object({
	login: z.string(),
	displayName: z.string(),
	id: z.string(),
	bio: z.string().nullable(),
	follows: z.null(),
	followers: z.number(),
	profileViewCount: z.null(),
	chatColor: z.string().nullable(),
	logo: z.string(),
	banner: z.string().nullable(),
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
		startedAt: z.string().nullable(),
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

export const ivrFoundersSchema = z.object({
	founders: z.array(z.object({
		isSubscribed: z.boolean(),
		id: z.string(),
		login: z.string(),
		displayName: z.string(),
		entitlementStart: z.iso.datetime()
	}))
});

export const ivrClipSchema = z.object({
	clip: z.object({
		durationSeconds: z.int(),
		id: z.string(),
		slug: z.string(),
		url: z.string(),
		title: z.string(),
		viewCount: z.int(),
		game: z.object({
			id: z.string(),
			name: z.string()
		}).optional(),
		broadcaster: z.object({
			id: z.string(),
			displayName: z.string()
		}).optional(),
		curator: z.object({
			id: z.string(),
			displayName: z.string()
		}).optional(),
		createdAt: z.iso.datetime(),
		tiny: z.string().optional(),
		small: z.string().optional(),
		medium: z.string().optional(),
		videoQualities: z.array(z.object({
			frameRate: z.number().positive(),
			quality: z.string(),
			sourceURL: z.string()
		}))
	}),
	clipKey: z.string().optional()
});
