import { CronJob } from "cron";

import ActiveChattersLog from "./active-chatters-log/index.js";
import BotActivity from "./bot-active/index.js";
import BotRequestDenialManager from "./bot-request-denial-manager/index.js";
import ChangelogAnnouncer from "./changelog-announcer/index.js";
import TwitchSubscribersFetcher from "./fetch-twitch-subscriber-list/index.js";
import GlobalEmoteAnnouncer from "./global-emote-announcer/index.js";
import InactiveDiscordServersDetector from "./inactive-discord-server-detector/index.js";
import LateStreamChecker from "./late-stream-announcer/index.js";
import PostureChecker from "./posture-check/index.js";
import StayHydratedChecker from "./stay-hydrated/index.js";
import StreamSilencePreventer from "./stream-silence-prevention/index.js";
import SuggestionNotificator from "./suggestion-notification-system/index.js";
import SupinicAdvertiser from "./supinic-advert/index.js";
import TitlechangeBotAnnouncer from "./supinic-tcb/index.js";
import SoundcloudClientIdFetcher from "./yoink-soundcloud-client-id/index.js";

const definitions = [
	ActiveChattersLog,
	BotActivity,
	BotRequestDenialManager,
	ChangelogAnnouncer,
	TwitchSubscribersFetcher,
	GlobalEmoteAnnouncer,
	InactiveDiscordServersDetector,
	LateStreamChecker,
	PostureChecker,
	StayHydratedChecker,
	SuggestionNotificator,
	StreamSilencePreventer,
	SupinicAdvertiser,
	TitlechangeBotAnnouncer,
	SoundcloudClientIdFetcher
];

export type CronDefinition = {
	name: string;
	expression: string;
	description: string;
	code: (this: CronWrapper) => void | Promise<void>;
};

class CronWrapper {
	public readonly name: string;
	public readonly description: string | null;
	public readonly expression: string;
	public readonly job: CronJob;

	constructor (def: CronDefinition) {
		this.name = def.name;
		this.expression = def.expression;
		this.description = def.description;

		const fn = def.code.bind(this);
		this.job = CronJob.from({
			cronTime: def.expression,
			onTick: () => fn(),
			start: true
		});
	}
}

type InitOptions = {
	disableAll?: boolean;
	blacklist?: string[];
	whitelist?: string[];
};

export default function initializeCrons (options: InitOptions = {}): CronWrapper[] {
	const {
		disableAll,
		blacklist = [],
		whitelist = []
	} = options;

	if (disableAll) {
		return [];
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

		const cron = new CronWrapper(definition);
		crons.push(cron);
	}

	return crons;
}
