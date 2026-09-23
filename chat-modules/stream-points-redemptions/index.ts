import * as z from "zod";
import { defineChatModule } from "../../classes/chat-module.js";

// @todo likely refactor to its own event type "reward" or something, instead of hooking onto "message"
export default defineChatModule({
	name: "stream-points-redemptions",
	description: "Reacts to redemptions",
	platform: ["twitch"],
	scope: "channel",
	config: z.array(z.object({
		name: z.string(),
		redemption: z.string(),
		reply: z.string()
	})).min(1),
	handlers: {
		async message (context, { config }) {
			if (context.raw) {
				return;
			}

			const { channel, data } = context;
			if (channel.Mode === "Read" || !data.customRewardId) {
				return;
			}

			const redemption = config.find(i => i.redemption === data.customRewardId);
			if (!redemption) {
				return;
			}

			await channel.send(redemption.reply);
		}
	}
});
