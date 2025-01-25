import { CronJob } from "cron";

import ActiveChattersLog from "./active-chatters-log/index.js";
import BotActivity from "./bot-active/index.js";
import BotRequestDenialManager from "./bot-request-denial-manager/index.js";
import ChangelogAnnouncer from "./changelog-announcer/index.js";
import TwitchSubscribersFetcher from "./fetch-twitch-subscriber-list/index.js";
import InactiveDiscordServersDetector from "./inactive-discord-server-detector/index.js";
import LateStreamChecker from "./late-stream-announcer/index.js";
import PostureChecker from "./posture-check/index.js";
import StayHydratedChecker from "./stay-hydrated/index.js";
import StreamSilencePreventer from "./stream-silence-prevention/index.js";
import SuggestionNotificator from "./suggestion-notification-system/index.js";
import SupinicAdvertiser from "./supinic-advert/index.js";
import TitlechangeBotAnnouncer from "./supinic-tcb/index.js";
// import TrainwrecksTwitterArchiver from "./train-twitter-archiver/index.mjs";
import SoundcloudClientIdFetcher from "./yoink-soundcloud-client-id/index.js";

const definitions = [
	ActiveChattersLog,
	BotActivity,
	BotRequestDenialManager,
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

export default function initializeCrons (options = {}) {
	const {
		disableAll,
		blacklist = [],
		whitelist = []
	} = options;
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
