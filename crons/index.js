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

export const definitions = [
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
