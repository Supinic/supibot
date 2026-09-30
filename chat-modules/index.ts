import AsyncMarkovExperimentModule from "./async-markov-experiment/index.ts";
import BotFaqHelperModule from "./bot-faq-helper/index.ts";
import ChatSuggestionLinkerModule from "./chat-suggestion-linker/index.ts";
import DiscordAnnouncementSubscriber from "./discord-announcement-subscriber/index.ts";
import LinkGathererModule from "./link-gatherer/index.ts";
import LiveDetectionModule from "./live-detection/index.ts";
import MessageReactionModule from "./message-react/index.ts";
import OfflineOnlyMirrorModule from "./offline-only-mirror/index.ts";
import OfflineOnlyModeModule from "./offline-only-mode/index.ts";
import PajbotAlertResponderModule from "./pajbot-alert-responder/index.ts";
import PajbotRaffleJoinerModule from "./pajbot-raffle-joiner/index.ts";
import PingSupiModule from "./ping-supi/index.ts";
import PyramidDetectionModule from "./pyramid-detection/index.ts";
import RaidReactionModule from "./raid-react/index.ts";
import RaidReactionTtsModule from "./raid-react-tts/index.ts";
import StreamPointsRedemptionModule from "./stream-points-redemptions/index.ts";
import SubscriptionReactionModule from "./subscription-react/index.ts";
import SubscriptionReactionTtsModule from "./subscription-react-tts/index.ts";
import StreamDatabaseUpdaterModule from "./supinic-stream-db/index.ts";
import SuspiciousUserAutoCheckerModule from "./suspicious-user-auto-check/index.ts";
import WannaBecomeFamousModule from "./wanna-become-famous/index.ts";

import type { ChatModuleRuntimeFor, GenericChatModuleDefinition } from "../classes/chat-module.ts";

declare module "../classes/chat-module.ts" {
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
