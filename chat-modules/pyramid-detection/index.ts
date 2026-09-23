import * as z from "zod";
import { defineChatModule } from "../../classes/chat-module.js";

type PyramidData = {
	base: string;
	maxLevel: number;
	level: number;
	ascending: boolean;
};

export default defineChatModule({
	name: "pyramid-detection",
	description: "Detects \"pyramids\" in chat. Congratulates the persons who finishes one and demeans the persons who break one.",
	platform: ["twitch"],
	scope: "channel",
	config: z.object({ threshold: z.number().optional() }),
	state: () => ({ pyramid: null as PyramidData | null }),
	handlers: {
		async message (context, { state, config }) {
			const { channel, message, user } = context;
			if (channel.Mode === "Read") {
				return;
			}
			else if (!user || user.Name === channel.Platform.selfName) {
				return;
			}

			const normalMessage = `${message.trim().replaceAll(/\s+/g, " ")} `;
			state.pyramid ??= {
				base: normalMessage,
				maxLevel: 1,
				level: 1,
				ascending: true
			};

			const pyramid = state.pyramid;
			const previousLevel = pyramid.level;
			if (pyramid.ascending && pyramid.base.repeat(pyramid.level + 1) === normalMessage) {
				pyramid.maxLevel++;
				pyramid.level++;
			}
			else if (pyramid.base.repeat(pyramid.level - 1) === normalMessage) {
				pyramid.ascending = false;
				pyramid.level--;
			}

			const { threshold = 3 } = config;
			const platform = channel.Platform;

			if (previousLevel !== pyramid.level && !pyramid.ascending && pyramid.level === 1) {
				if (pyramid.maxLevel >= threshold) {
					const emote = await platform.getBestAvailableEmote(channel, ["PagMan", "PagChomp", "Pog", "ShoopDaWhoop"], "🥳", { shuffle: true });
					await channel.send(`${user.Name} finished a ${pyramid.maxLevel} tall pyramid ${emote} Clap`);
				}

				pyramid.maxLevel = 1;
				pyramid.ascending = true;
				pyramid.level = 1;
				pyramid.base = normalMessage;
			}
			else if (previousLevel === pyramid.level) {
				if (pyramid.maxLevel >= threshold) {
					const emote = await platform.getBestAvailableEmote(channel, ["PagMan", "PagChomp", "Pog", "ShoopDaWhoop"], "🥳", { shuffle: true });
					await channel.send(`${user.Name} ruined a ${pyramid.maxLevel} tall pyramid ${emote} Clap`);
				}

				pyramid.maxLevel = 1;
				pyramid.ascending = true;
				pyramid.level = 1;
				pyramid.base = normalMessage;
			}
		}
	}
});
