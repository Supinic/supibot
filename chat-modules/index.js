import AsyncMarkovExperimentModule from "./async-markov-experiment/index.js";
import BotFaqHelperModule from "./bot-faq-helper/index.js";
import ChatSuggestionLinkerModule from "./chat-suggestion-linker/index.js";
import DiscordAnnouncementSubscriber from "./discord-announcement-subscriber/index.js";
import ImgurLinkGathererModule from "./imgur-link-gatherer/index.js";
import LiveDetectionModule from "./live-detection/index.js";
import MessageReactionModule from "./message-react/index.js";
import OfflineOnlyMirrorModule from "./offline-only-mirror/index.js";
import OfflineOnlyModeModule from "./offline-only-mode/index.js";
import PajbotAlertResponderModule from "./pajbot-alert-responder/index.js";
import PajbotRaffleJoinerModule from "./pajbot-raffle-joiner/index.js";
import PingSupiModule from "./ping-supi/index.js";
import PyramidDetectionModule from "./pyramid-detection/index.js";
import RaidReactionModule from "./raid-react/index.js";
import RaidReactionTtsModule from "./raid-react-tts/index.js";
import StreamPointsRedemptionModule from "./stream-points-redemptions/index.js";
import SubscriptionReactionModule from "./subscription-react/index.js";
import SubscriptionReactionTtsModule from "./subscription-react-tts/index.js";
import SilencePreventionTriggerModule from "./supinic-silence-prevention-trigger/index.js";
import StreamDatabaseUpdaterModule from "./supinic-stream-db/index.js";
import SuspiciousUserAutoCheckerModule from "./suspicious-user-auto-check/index.js";
import WannaBecomeFamousModule from "./wanna-become-famous/index.js";

export default [
	AsyncMarkovExperimentModule,
	BotFaqHelperModule,
	ChatSuggestionLinkerModule,
	DiscordAnnouncementSubscriber,
	ImgurLinkGathererModule,
	LiveDetectionModule,
	MessageReactionModule,
	OfflineOnlyMirrorModule,
	OfflineOnlyModeModule,
	PajbotAlertResponderModule,
	PajbotRaffleJoinerModule,
	PingSupiModule,
	PyramidDetectionModule,
	RaidReactionModule,
	RaidReactionTtsModule,
	StreamPointsRedemptionModule,
	SubscriptionReactionModule,
	SubscriptionReactionTtsModule,
	SilencePreventionTriggerModule,
	StreamDatabaseUpdaterModule,
	SuspiciousUserAutoCheckerModule,
	WannaBecomeFamousModule
];
