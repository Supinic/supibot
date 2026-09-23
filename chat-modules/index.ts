import AsyncMarkovExperimentModule from "./async-markov-experiment/index.js";
import BotFaqHelperModule from "./bot-faq-helper/index.js";
import ChatSuggestionLinkerModule from "./chat-suggestion-linker/index.js";
import DiscordAnnouncementSubscriber from "./discord-announcement-subscriber/index.js";
import LinkGathererModule from "./link-gatherer/index.js";
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
import StreamDatabaseUpdaterModule from "./supinic-stream-db/index.js";
import SuspiciousUserAutoCheckerModule from "./suspicious-user-auto-check/index.js";
import WannaBecomeFamousModule from "./wanna-become-famous/index.js";

import type { ChatModuleRuntimeFor, GenericChatModuleDefinition } from "../classes/chat-module.js";

declare module "../classes/chat-module.js" {
	interface ChatModuleRuntimeMap {
		"async-markov-experiment": ChatModuleRuntimeFor<typeof AsyncMarkovExperimentModule>;
	}
}

export const chatModuleDefinitions = [
	AsyncMarkovExperimentModule,
	BotFaqHelperModule,
	ChatSuggestionLinkerModule,
	DiscordAnnouncementSubscriber,
	LinkGathererModule,
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
	StreamDatabaseUpdaterModule,
	SuspiciousUserAutoCheckerModule,
	WannaBecomeFamousModule
] as const satisfies GenericChatModuleDefinition[];
