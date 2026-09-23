import { SupiDate } from "supi-core";
import { defineChatModule } from "../../classes/chat-module.js";

export default defineChatModule({
	name: "bot-faq-helper",
	description: "Attempts to auto-reply to various queries related to the bot",
	platform: "all",
	scope: "channel",
	handlers: {
		message: async function (context) {
			if (!context.user?.Name) {
				return;
			}

			const { message } = context;
			if (message.startsWith("$")) {
				return;
			}

			const lower = message.toLowerCase();
			if ((!lower.includes("how can i") && !lower.includes("how do i")) || !lower.includes("supibot")) {
				return;
			}

			const now = SupiDate.now();
			const key = `bot-faq-helper-timeout-${context.channel.ID}`;
			const skipRepeat = await core.Cache.getByPrefix(key) as true | undefined;
			if (skipRepeat) {
				return;
			}

			await core.Cache.setByPrefix(key, true, { expiry: now + 60_000 });
			await context.channel.send(`@${context.user.Name}, you should check the FAQ first: https://supinic.com/data/faq/list :)`);
		}
	}
});
