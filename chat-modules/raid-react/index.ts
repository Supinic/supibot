import * as z from "zod";
import { defineChatModule } from "../../classes/chat-module.js";

export default defineChatModule({
	name: "raid-react",
	description: "According to arguments, reacts to a Twitch channel being raided.",
	scope: "channel",
	platform: ["twitch"],
	config: z.object({ message: z.string() }),
	handlers: {
		async raid (context, { config }) {
			const { channel } = context;
			if (channel.Mode === "Read") {
				return;
			}

			await channel.send(config.message);
		}
	}
});
