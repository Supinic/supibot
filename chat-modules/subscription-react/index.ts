import * as z from "zod";
import { defineChatModule } from "../../classes/chat-module.js";

export default defineChatModule({
	name: "subscription-react",
	description: "According to arguments, reacts to a subscription in a Twitch channel.",
	scope: "channel",
	platform: ["twitch"],
	config: z.object({ message: z.string() }),
	handlers: {
		async subscription (context, { config }) {
			const { channel, platform, user } = context;
			if (channel.Mode === "Read") {
				return;
			}
			if (user.Name === platform.selfName) {
				return;
			}

			await channel.send(config.message);
		}
	}
});
