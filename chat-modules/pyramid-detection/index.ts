import { defineChatModule } from "../../classes/chat-module.js";
import type { Channel } from "../../classes/channel.js";

type PyramidData = {
	base: string;
	maxLevel: number;
	level: number;
	ascending: boolean;
};

const pyramids = new Map<Channel["ID"], PyramidData>();

export default defineChatModule({
	name: "pyramid-detection",
	description: "Detects \"pyramids\" in chat. Congratulates the persons who finishes one and demeans the persons who break one.",
	platform: ["twitch"],
	scope: "channel",
	handlers: {
		async message (context, options = {}) {
			const { channel, message, user } = context;
			if (channel.Mode === "Read") {
				return;
			}
			else if (!user || user.Name === channel.Platform.selfName) {
				return;
			}

			const normalMessage = `${message.trim().replaceAll(/\s+/g, " ")} `;
			let pyramidData = pyramids.get(channel.ID);
			if (!pyramidData) {
				pyramidData = {
					base: normalMessage,
					maxLevel: 1,
					level: 1,
					ascending: true
				};
				pyramids.set(channel.ID, pyramidData);
			}

			const previousLevel = pyramidData.level;
			if (pyramidData.ascending && pyramidData.base.repeat(pyramidData.level + 1) === normalMessage) {
				pyramidData.maxLevel++;
				pyramidData.level++;
			}
			else if (pyramidData.base.repeat(pyramidData.level - 1) === normalMessage) {
				pyramidData.ascending = false;
				pyramidData.level--;
			}

			const { threshold = 3 } = options;
			const platform = channel.Platform;

			if (previousLevel !== pyramidData.level && !pyramidData.ascending && pyramidData.level === 1) {
				if (pyramidData.maxLevel >= threshold) {
					const emote = await platform.getBestAvailableEmote(channel, ["PagMan", "PagChomp", "Pog", "ShoopDaWhoop"], "🥳", { shuffle: true });
					await channel.send(`${user.Name} finished a ${pyramidData.maxLevel} tall pyramid ${emote} Clap`);
				}

				pyramidData.maxLevel = 1;
				pyramidData.ascending = true;
				pyramidData.level = 1;
				pyramidData.base = normalMessage;
			}
			else if (previousLevel === pyramidData.level) {
				if (pyramidData.maxLevel >= threshold) {
					const emote = await platform.getBestAvailableEmote(channel, ["PagMan", "PagChomp", "Pog", "ShoopDaWhoop"], "🥳", { shuffle: true });
					await channel.send(`${user.Name} ruined a ${pyramidData.maxLevel} tall pyramid ${emote} Clap`);
				}

				pyramidData.maxLevel = 1;
				pyramidData.ascending = true;
				pyramidData.level = 1;
				pyramidData.base = normalMessage;
			}
		}
	}
});
