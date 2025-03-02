import { postToHastebin } from "../../utils/command-utils.js";
import type { CronDefinition } from "../temp-definitions.d.ts";
import { SupiDate } from "supi-core";

type HelixResponse = {
	data: {
		id: string;
		name: string;
	}[];
};
type EmoteJsonObject = {
	timestamp: number;
	added: HelixResponse["data"];
	deleted: HelixResponse["data"];
};

const cacheKey = "twitch-global-emotes";
const fetchTwitchGlobalEmotes = () => sb.Got.get("Helix")<HelixResponse>({
	url: "chat/emotes/global",
	method: "GET",
	throwHttpErrors: false
});

let previousEmoteIds: Set<string>;
const definition: CronDefinition = {
	name: "global-emote-announcer",
	expression: "0 */5 * * * *",
	description: "Periodically checks Twitch global emotes and announce",
	code: (async function globalEmoteAnnouncer (cron) {
		const twitchPlatform = sb.Platform.get("twitch");
		if (!twitchPlatform) {
			cron.job.stop();
			return;
		}

		const channelData = sb.Channel.get("supinic", twitchPlatform);
		if (!channelData) {
			cron.job.stop();
			return;
		}

		if (!previousEmoteIds || previousEmoteIds.size === 0) {
			let data = await sb.Cache.getByPrefix(cacheKey) as string[] | null;
			if (!data) {
				const response = await fetchTwitchGlobalEmotes();
				if (!response.ok) {
					return;
				}

				data = response.body.data.map(i => i.id);
				await sb.Cache.setByPrefix(cacheKey, data, {
					expiry: 7 * 864e5 // 7 days
				});
			}

			previousEmoteIds = new Set(data);
			return;
		}

		const response = await fetchTwitchGlobalEmotes();
		if (!response.ok) {
			return;
		}

		const emotes = response.body.data;
		const newEmoteIds = new Set(emotes.map(i => i.id));
		const differentEmoteIds = previousEmoteIds.symmetricDifference(newEmoteIds);
		if (differentEmoteIds.size === 0) {
			return;
		}

		const now = new SupiDate();
		const result: string[] = [];
		const json: EmoteJsonObject = {
			timestamp: now.valueOf(),
			added: [],
			deleted: []
		};

		for (const emoteId of differentEmoteIds) {
			const emote = emotes.find(i => i.id === emoteId);
			if (!emote) {
				continue;
			}

			if (previousEmoteIds.has(emoteId)) {
				result.push(`deleted: ${emote.name}`);
				json.deleted.push({
					id: emote.id,
					name: emote.name
				});
			}
			if (newEmoteIds.has(emoteId)) {
				result.push(`added: ${emote.name}`);
				json.added.push({
					id: emote.id,
					name: emote.name
				});
			}
		}

		previousEmoteIds = newEmoteIds;
		await sb.Cache.setByPrefix(cacheKey, [...newEmoteIds], {
			expiry: 7 * 864e5 // 7 days
		});

		const hastebinResult = await postToHastebin(JSON.stringify(json, null, 4), {
			title: `Twitch global emote change ${now.sqlDateTime()}`
		});

		const hastebinLink = (hastebinResult.ok)
			? hastebinResult.link
			: "(Hastebin link N/A)";

		await channelData.send(`Global Twitch emotes changed: ${result.join(" ")} ${hastebinLink}`);
	})
};

export default definition;
