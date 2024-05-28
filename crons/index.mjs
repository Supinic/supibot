import { CronJob } from "cron";

import { definition as ActiveChattersLog } from "./active-chatters-log/index.mjs";
import { definition as BotActivity } from "./bot-active/index.mjs";
import { definition as BotRequestDenialManager } from "./bot-request-denial-manager/index.mjs";
import { definition as BotScopeInfo } from "./bot-scopes-info/index.mjs";
import { definition as ChangelogAnnouncer } from "./changelog-announcer/index.mjs";
import { definition as TwitchSubscribersFetcher } from "./fetch-twitch-subscriber-list/index.mjs";
import { definition as InactiveDiscordServersDetector } from "./inactive-discord-server-detector/index.mjs";
import { definition as LateStreamChecker } from "./late-stream-announcer/index.mjs";
import { definition as PostureChecker } from "./posture-check/index.mjs";
import { definition as StayHydratedChecker } from "./stay-hydrated/index.mjs";
import { definition as StreamSilencePreventer } from "./stream-silence-prevention/index.mjs";
import { definition as SuggestionNotificator } from "./suggestion-notification-system/index.mjs";
import { definition as SupinicAdvertiser } from "./supinic-advert/index.mjs";
import { definition as TitlechangeBotAnnouncer } from "./supinic-tcb/index.mjs";
// import { definition as TrainwrecksTwitterArchiver } from "./train-twitter-archiver/index.mjs";
import { definition as SoundcloudClientIdFetcher } from "./yoink-soundcloud-client-id/index.mjs";

export const definitions = [
	ActiveChattersLog,
	BotActivity,
	BotRequestDenialManager,
	BotScopeInfo,
	ChangelogAnnouncer,
	TwitchSubscribersFetcher,
	InactiveDiscordServersDetector,
	LateStreamChecker,
	PostureChecker,
	StayHydratedChecker,
	SuggestionNotificator,
	StreamSilencePreventer,
	SupinicAdvertiser,
	TitlechangeBotAnnouncer,
	// Temporarily disabled due to Twitter API changes - will possibly be shelved entirely
	// TrainwrecksTwitterArchiver,
	SoundcloudClientIdFetcher
];

export function initializeCrons (options = {}) {
	const { disableAll, blacklist = [], whitelist = [] } = options;
	if (disableAll) {
		return;
	}
	else if (whitelist.length > 0 && blacklist.length > 0) {
		throw new Error(`Cannot combine blacklist and whitelist for crons`);
	}

	const crons = [];
	for (const definition of definitions) {
		if (blacklist.length > 0 && blacklist.includes(definition.name)) {
			continue;
		}
		else if (whitelist.length > 0 && !whitelist.includes(definition.name)) {
			continue;
		}

		const cron = {
			name: definition.name,
			description: definition.description,
			code: definition.code
		};

		const job = new CronJob(definition.expression, () => cron.code(cron));
		job.start();

		cron.job = job;
		crons.push(cron);
	}

	return crons;
}
