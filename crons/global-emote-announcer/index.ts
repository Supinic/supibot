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
	changed: string[];
	added: HelixResponse["data"];
	deleted: HelixResponse["data"];
};
type EmoteDescriptor = { name: string; id: string; };

const cacheKey = "twitch-global-emotes";
const fetchTwitchGlobalEmotes = () => core.Got.get("Helix")<HelixResponse>({
	url: "chat/emotes/global",
	method: "GET",
	throwHttpErrors: false
});

let previousEmotes: EmoteDescriptor[] | undefined;
const definition: CronDefinition = {
	name: "global-emote-announcer",
	expression: "0 */5 * * * *",
	description: "Periodically checks Twitch global emotes and announce",
	code: (async function globalEmoteAnnouncer (cron) {
		const twitchPlatform = sb.Platform.get("twitch");
		if (!twitchPlatform) {
			await cron.job.stop();
			return;
		}

		const channelData = sb.Channel.get("supinic", twitchPlatform);
		if (!channelData) {
			await cron.job.stop();
			return;
		}

		if (!previousEmotes || previousEmotes.length === 0) {
			let data = await core.Cache.getByPrefix(cacheKey) as EmoteDescriptor[] | null;
			if (!data) {
				const response = await fetchTwitchGlobalEmotes();
				if (!response.ok) {
					return;
				}

				data = response.body.data.map(i => ({
					id: i.id,
					name: i.name
				}));

				await core.Cache.setByPrefix(cacheKey, data, {
					expiry: 7 * 864e5 // 7 days
				});
			}

			previousEmotes = data;
			return;
		}

		const response = await fetchTwitchGlobalEmotes();
		if (!response.ok) {
			return;
		}

		const newEmotes = response.body.data;
		const previousEmoteIds = new Set(previousEmotes.map(i => i.id));
		const newEmoteIds = new Set(newEmotes.map(i => i.id));
		const differentEmoteIds = previousEmoteIds.symmetricDifference(newEmoteIds);
		if (differentEmoteIds.size === 0) {
			return;
		}

		const now = new SupiDate();
		const result: string[] = [];
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

		previousEmotes = newEmotes.map(i => ({ id: i.id, name: i.name }));
		await core.Cache.setByPrefix(cacheKey, [...newEmoteIds], {
			expiry: 7 * 864e5 // 7 days
		});

		const hastebinResult = await postToHastebin(JSON.stringify(json, null, 4), {
			title: `Twitch global emote change ${now.sqlDateTime()}`
		});

		const hastebinLink = (hastebinResult.ok) ? hastebinResult.link : "(Hastebin link N/A)";
		const suggestionRow = await core.Query.getRow("data", "Suggestion");
		suggestionRow.setValues({
			User_Alias: 1,
			Text: `Global emote change, add to Origin: ${hastebinLink}`,
			Priority: 255,
			Category: "Data"
		});

		await suggestionRow.save({ skipLoad: true });

		await channelData.send(`Global Twitch emotes changed: ${result.join(" ")} ${hastebinLink}`);
	})
};

export default definition;
