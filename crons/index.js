import { definition as ActiveChattersLog } from "./active-chatters-log/index.mjs";
import { definition as ActivePoll } from "./active-poll/index.mjs";
import { definition as BotActivity } from "./bot-active/index.mjs";
import { definition as BotRequestDenialManager } from "./bot-request-denial-manager/index.mjs";
import { definition as ChangelogAnnouncer } from "./changelog-announcer/index.mjs";
import { definition as PollsCloser } from "./close-polls/index.mjs";
import { definition as TwitchSubscribersFetcher } from "./fetch-twitch-subscriber-list/index.mjs";
import { definition as InactiveDiscordServersDetector } from "./inactive-discord-server-detector/index.mjs";
import { definition as LateStreamChecker } from "./late-stream-announcer/index.mjs";
import { definition as NodeJsVersionAnnouncer } from "./nodejs/index.mjs";
import { definition as OldSchoolRunescapeNewsAnnouncer } from "./osrs-news-checker/index.mjs";
import { definition as PostureChecker } from "./posture-check/index.mjs";
import { definition as RuneliteVersionAnnouncer } from "./runelite-version-updater/index.mjs";
import { definition as RustNewsAnnouncer } from "./rust-news-checker/index.mjs";
import { definition as StayHydratedChecker } from "./stay-hydrated/index.mjs";
import { definition as StreamSilencePreventer } from "./stream-silence-prevention/index.mjs";
import { definition as SupinicAdvertiser } from "./supinic-advert/index.mjs";
import { definition as TitlechangeBotAnnouncer } from "./supinic-tcb/index.mjs";
import { definition as TrainwreckstTwitterArchiver } from "./train-twitter-archiver/index.mjs";
import { definition as V8VersionAnnouncer } from "./v8-version-checker/index.mjs";
import { definition as SoundcloudClientIdFetcher } from "./yoink-soundcloud-client-id/index.mjs";

const definitions = [
	ActiveChattersLog,
	ActivePoll,
	BotActivity,
	BotRequestDenialManager,
	ChangelogAnnouncer,
	PollsCloser,
	TwitchSubscribersFetcher,
	InactiveDiscordServersDetector,
	LateStreamChecker,
	NodeJsVersionAnnouncer,
	OldSchoolRunescapeNewsAnnouncer,
	PostureChecker,
	RuneliteVersionAnnouncer,
	RustNewsAnnouncer,
	StayHydratedChecker,
	StreamSilencePreventer,
	SupinicAdvertiser,
	TitlechangeBotAnnouncer,
	TrainwreckstTwitterArchiver,
	V8VersionAnnouncer,
	SoundcloudClientIdFetcher
];

export { definitions };
export default definitions;
