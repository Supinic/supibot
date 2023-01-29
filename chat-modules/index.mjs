import { definition as AsyncMarkovExperiment } from "./async-markov-experiment/index.mjs";
import { definition as AutomaticUnscramble } from "./automatic-unscramble/index.mjs";
import { definition as ChatSuggestionLinker } from "./chat-suggestion-linker/index.mjs";
import { definition as LiveDetection } from "./live-detection/index.mjs";
import { definition as MessageReaction } from "./message-react/index.mjs";
import { definition as OfflineOnlyMirror } from "./offline-only-mirror/index.mjs";
import { definition as OfflineOnlyMode } from "./offline-only-mode/index.mjs";
import { definition as PingSupi } from "./ping-supi/index.mjs";
import { definition as PyramidDetection } from "./pyramid-detection/index.mjs";
import { definition as RaidReaction } from "./raid-react/index.mjs";
import { definition as StreamPointsRedemption } from "./stream-points-redemptions/index.mjs";
import { definition as StreamerHealthNotification } from "./streamer-health-notification/index.mjs";
import { definition as SubscriptionReaction } from "./subscription-react/index.mjs";
import { definition as SilencePreventionTrigger } from "./supinic-silence-prevention-trigger/index.mjs";
import { definition as StreamDatabaseUpdater } from "./supinic-stream-db/index.mjs";
import { definition as WannaBecomeFamous } from "./wanna-become-famous/index.mjs";

const definitions = [
	AsyncMarkovExperiment,
	AutomaticUnscramble,
	ChatSuggestionLinker,
	LiveDetection,
	MessageReaction,
	OfflineOnlyMirror,
	OfflineOnlyMode,
	PingSupi,
	PyramidDetection,
	RaidReaction,
	StreamPointsRedemption,
	AsyncMarkovExperiment,
	StreamerHealthNotification,
	SubscriptionReaction,
	SilencePreventionTrigger,
	StreamDatabaseUpdater,
	WannaBecomeFamous
];

export { definitions };
export default definitions;
