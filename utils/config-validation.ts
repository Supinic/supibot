/* eslint-disable newline-per-chained-call */
import * as z from "zod";

import { BasePlatformConfigSchema, ALLOWED_PLATFORM_TYPES } from "../platforms/template.js";
import { TwitchConfigSchema } from "../platforms/twitch.js";
import { DiscordConfigSchema } from "../platforms/discord.js";
import { CytubeConfigSchema } from "../platforms/cytube.js";
import { IrcConfigSchema } from "../platforms/irc.js";

const PlatformConfigSchema = BasePlatformConfigSchema.extend({
	type: z.enum(ALLOWED_PLATFORM_TYPES)
});
const port = z.int().positive().max(65536);
const loggingObject = z.discriminatedUnion("enabled", [
	z.object({ enabled: z.literal(false), cron: z.string().optional() }),
	z.object({ enabled: z.literal(true), cron: z.string() })
]);
const moduleBase = (name: string) => z.object({
	disableAll: z.boolean().optional(),
	blacklist: z.array(z.string()),
	whitelist: z.array(z.string())
}).refine(
	({ blacklist, whitelist }) => (
		(blacklist.length === 0 && whitelist.length === 0)
		|| (blacklist.length === 0) !== (whitelist.length === 0)
	),
	{
		error: "The lists must be either both empty, or only one filled",
		path: [name]
	}
);
const rustlogInstances = z.record(z.string(), z.object({
	default: z.boolean().optional(),
	url: z.string()
}));

export default z.object({
	responses: z.object({
		defaultBanphrase: z.string(),
		commandErrorResponse: z.string()
	}),
	values: z.object({
		pendingCommandTimeout: z.int().positive(),
		pajbotBanphraseRequestTimeout: z.int().positive(),
		commandCodeUrlPrefix: z.string(),
		commandDetailUrlPrefix: z.string(),
		maxIncomingActiveReminders: z.int().positive(),
		maxOutgoingActiveReminders: z.int().positive(),
		maxIncomingScheduledReminders: z.int().positive(),
		maxOutgoingScheduledReminders: z.int().positive(),
		userAdditionHighLoadThreshold: z.int().positive(),
		userAdditionCriticalLoadThreshold: z.int().positive(),
		massPingBanphraseThreshold: z.int().positive()
	}).superRefine((data, context) => {
		if (data.userAdditionHighLoadThreshold >= data.userAdditionCriticalLoadThreshold) {
			context.addIssue({
				code: "custom",
				message: "High load threshold must be lower than critical load threshold`",
				path: ["userAdditionHighLoadThreshold"]
			});
		}
	}),
	local: z.object({
		epalAudioChannels: z.array(z.int().positive()).optional().nullable(),
		listenerAddress: z.string().optional().nullable(),
		port: port.optional().nullable(),
		ttsVolume: z.int().min(0).max(8).optional().nullable(),
		ttsLengthLimit: z.int().positive().optional().nullable(),
		ttsListUrl: z.string().optional().nullable(),
		playsoundListUrl: z.string().optional().nullable(),
		vlcBaseUrl: z.string().optional().nullable(),
		vlcUrl: z.string().optional().nullable(),
		vlcUsername: z.string().optional().nullable(),
		vlcPassword: z.string().optional().nullable(),
		vlcPort: port.optional().nullable()
	}).optional(),
	api: z.object({
		secure: z.boolean().nullable().optional(),
		port: port.optional().nullable()
	}).optional(),
	rustlog: z.object({
		instances: rustlogInstances.superRefine((data, context) => {
			let defaultInstances = 0;
			const instances = Object.values(data);
			for (const instance of instances) {
				if (instance.default) {
					defaultInstances++;
				}
			}

			if (instances.length !== 0 && defaultInstances !== 1) {
				context.addIssue({
					code: "custom",
					message: "The object of Rustlog instances must have exactly one default instance",
					path: ["rustlog"]
				});
			}
		})
	}),
	logging: z.object({
		messages: loggingObject,
		commands: loggingObject,
		lastSeen: loggingObject,
		errors: z.object({ enabled: z.boolean() })
	}),
	modules: z.object({
		"chat-modules": moduleBase("chat-modules"),
		commands: moduleBase("commands").extend({
			prefix: z.string(),
			bannedCombinations: z.array(
				z.array(z.string())
			)
		}),
		crons: moduleBase("crons"),
		gots: moduleBase("gots").extend({
			defaultUserAgent: z.string()
		})
	}),
	platforms: z.array(PlatformConfigSchema).superRefine((data, context) => {
		const platformSchemaMap = {
			twitch: TwitchConfigSchema,
			discord: DiscordConfigSchema,
			cytube: CytubeConfigSchema,
			irc: IrcConfigSchema
		};

		for (const platform of data) {
			const schema = platformSchemaMap[platform.type];
			try {
				schema.parse(platform);
			}
			catch (e) {
				context.addIssue({
					code: "custom",
					error: e,
					path: ["platform", platform.type]
				});
			}
		}
	})
} satisfies z.ZodRawShape);
