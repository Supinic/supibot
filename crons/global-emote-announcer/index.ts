import { setTimeout as wait } from "node:timers/promises";
import * as z from "zod";
import { SupiDate } from "supi-core";

import type { CronDefinition } from "../index.js";
import { postToHastebin } from "../../utils/command-utils.js";
import subscriptionDefinition from "../../commands/subscribe/event-types/global-twitch-emotes.js";
import type { Channel } from "../../classes/channel.js";

const emoteSchema = z.object({
	data: z.array(z.object({
		id: z.string(),
		name: z.string()
	}))
});

type HelixResponse = {
	data: {
		id: string;
		name: string;
	}[];
};
type EmoteJsonObject = {
	timestamp: number;
	changed: string[];
	added: HelixResponse["data"];
	deleted: HelixResponse["data"];
};
type EmoteDescriptor = { name: string; id: string; };

const MAX_MESSAGES_SENT = 5;
const MULTI_MESSAGE_DELAY = 250;

const SANITY_EMOTE_AMOUNT = 25;
const cacheKey = "twitch-global-emotes";
const fetchTwitchGlobalEmotes = async () => {
	const response = await core.Got.get("Helix")({
		url: "chat/emotes/global",
		method: "GET",
		throwHttpErrors: false
	});

	return emoteSchema.parse(response.body).data;
};

let previousEmotes: EmoteDescriptor[] | undefined;
let suggestionTableExists: boolean | null = null;

export default {
	name: "global-emote-announcer",
	expression: "0 */5 * * * *",
	description: "Periodically checks Twitch global emotes and announce",
	code: (async function globalEmoteAnnouncer () {
		const twitchPlatform = sb.Platform.get("twitch");
		if (!twitchPlatform) {
			this.stop();
			return;
		}

		const channelData = sb.Channel.get("supinic", twitchPlatform);
		if (!channelData) {
			this.stop();
			return;
		}

		if (!previousEmotes || previousEmotes.length === 0) {
			let data = await core.Cache.getByPrefix(cacheKey) as EmoteDescriptor[] | null;
			if (!data) {
				data = await fetchTwitchGlobalEmotes();
				if (data.length === 0) {
					console.warn("No Helix emote data received!", { data });
					return;
				}

				await core.Cache.setByPrefix(cacheKey, data, {
					expiry: 7 * 864e5 // 7 days
				});
			}

			previousEmotes = data;
			return;
		}

		const newEmotes = await fetchTwitchGlobalEmotes();
		if (newEmotes.length === 0) { // Sanity fallback
			return;
		}

		const previousEmoteIds = new Set(previousEmotes.map(i => i.id));
		const newEmoteIds = new Set(newEmotes.map(i => i.id));
		const differentEmoteIds = previousEmoteIds.symmetricDifference(newEmoteIds);
		if (differentEmoteIds.size === 0) {
			return;
		}
		else if (differentEmoteIds.size > SANITY_EMOTE_AMOUNT) {
			console.warn("Too many emotes changed within the `global-emote-announcer` cron", {
				amount: differentEmoteIds.size,
				newEmoteIds: [...newEmoteIds],
				previousEmoteIds: [...previousEmoteIds]
			});

			return;
		}

		const now = new SupiDate();
		const json: EmoteJsonObject = {
			timestamp: now.valueOf(),
			added: [],
			deleted: [],
			changed: [...differentEmoteIds]
		};

		for (const emoteId of differentEmoteIds) {
			const emote = previousEmotes.find(i => i.id === emoteId) ?? newEmotes.find(i => i.id === emoteId);
			if (!emote) {
				continue;
			}

			const { id, name } = emote;
			if (previousEmoteIds.has(emoteId)) {
				json.deleted.push({ id, name });
			}
			if (newEmoteIds.has(emoteId)) {
				json.added.push({ id, name });
			}
		}

		previousEmotes = newEmotes.map(i => ({ id: i.id, name: i.name }));
		await core.Cache.setByPrefix(cacheKey, previousEmotes, {
			expiry: 7 * 864e5 // 7 days
		});

		const hastebinResult = await postToHastebin(JSON.stringify(json, null, 4), {
			title: `Twitch global emote change ${now.sqlDateTime()}`
		});

		const hastebinLink = (hastebinResult.ok) ? hastebinResult.link : "(Hastebin link N/A)";

		suggestionTableExists ??= await core.Query.isTablePresent("data", "Suggestion");
		if (suggestionTableExists) {
			const suggestionRow = await core.Query.getRow("data", "Suggestion");
			suggestionRow.setValues({
				User_Alias: 1,
				Text: `Global emote change, add to Origin: ${hastebinLink}`,
				Priority: 255,
				Category: "Data"
			});

			await suggestionRow.save({ skipLoad: true });
		}

		const subscriptionData = await core.Query.getRecordset<{ name: string; channel: Channel["ID"] }[]>(rs => rs
			.select("User_Alias.Name AS name", "Channel AS channel")
			.from("data", "Event_Subscription")
			.join("chat_data", "User_Alias")
			.where("Type = %s", subscriptionDefinition.name)
			.where("Active = %b", true)
		);

		if (subscriptionData.length === 0) {
			return;
		}

		const channelUserMap = new Map<Channel["ID"], string[]>();
		for (const { name, channel } of subscriptionData) {
			let arr = channelUserMap.get(channel);
			if (!arr) {
				arr = [];
				channelUserMap.set(channel, arr);
			}

			arr.push(name);
		}

		let message = `Global Twitch emotes changed! ${hastebinLink} `;
		if (json.added.length !== 0) {
			message += `Added: ${json.added.map(i => i.name).join(" ")}`;
		}
		if (json.deleted.length !== 0) {
			if (json.added.length !== 0) {
				message += " -- ";
			}

			message += `Deleted: ${json.deleted.map(i => i.name).join(" ")}`;
		}

		for (const [channelId, usernames] of channelUserMap.entries()) {
			const channelData = sb.Channel.getAsserted(channelId);
			const names = usernames.map(i => `@${i}`).join(" ");
			const finalMessage = `${names} ${message}`;

			const limit = channelData.Message_Limit ?? channelData.Platform.messageLimit;
			const chunks = core.Utils.partitionString(finalMessage, limit, MAX_MESSAGES_SENT);

			void (async (strings) => {
				for (const string of strings) {
					await channelData.send(string);
					await wait(MULTI_MESSAGE_DELAY);
				}
			})(chunks);
		}
	})
} satisfies CronDefinition;
