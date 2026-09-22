import AsyncMarkov from "async-markov";
import { TWITCH_ANTIPING_CHARACTER } from "../../utils/command-utils.js";
import { defineChatModule } from "../../classes/chat-module.js";
import type { Channel } from "../../classes/channel.js";

// only allows messages consisting of just emojis, or ASCII 32-126 characters (0x20-0x7E)
const allowRegex = /^[\p{Emoji}\u0020-\u007E]+$/ui;
const MARKOV_THRESHOLD = 250_000;
export const markovInstancesMap = new Map<Channel["ID"], AsyncMarkov>();

export default defineChatModule({
	name: "async-markov-experiment",
	description: "Super experimental automatic async markov tester thing",
	platform: "all",
	scope: "channel",
	state: () => ({
		markov: null as AsyncMarkov | null
	}),
	handlers: {
		message (context, runtime) {
			let { markov } = runtime.state;
			if (!markov) {
				markov = new AsyncMarkov();
				runtime.state.markov = markov;
			}

			if (markov.size > MARKOV_THRESHOLD) {
				return;
			}

			const { message, user } = context;
			if (message.includes("http:") || message.includes("https:")) {
				return;
			}
			else if (!user || user.Name.includes("bot")) {
				return;
			}

			const fixedMessage = message.replaceAll(TWITCH_ANTIPING_CHARACTER, "").normalize("NFKD");
			if (!allowRegex.test(fixedMessage)) {
				return;
			}

			markov.add(fixedMessage);
		}
	}
});
