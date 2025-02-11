import { postToHastebin } from "../../utils/command-utils.js";

const cacheKey = "twitch-global-emotes";
const fetchTwitchGlobalEmotes = () => sb.Got.get("Helix")({
	url: "chat/emotes/global",
	method: "GET",
	throwHttpErrors: false
});

/** @type {Set<string>} */
let previousEmoteIds;
export default {
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
			let data = await sb.Cache.getByPrefix(cacheKey);
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
		/** @type {Set<string>} */
		const newEmoteIds = new Set(emotes.map(i => i.id));
		/** @type {Set<string>} */
		const differentEmoteIds = previousEmoteIds.symmetricDifference(newEmoteIds);
		if (differentEmoteIds.size === 0) {
			return;
		}

		const now = new sb.Date();
		const result = [];
		const json = {
			timestamp: now.valueOf(),
			added: [],
			deleted: []
		};

		for (const emoteId of differentEmoteIds) {
			const emote = emotes.find(i => i.id === emoteId);
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

		const hastebinResult = await postToHastebin(JSON.stringify(json, null, 4), {
			title: `Twitch global emote change ${now.sqlDateTime()}`
		});

		const hastebinLink = (hastebinResult.ok)
			? hastebinResult.link
			: "(Hastebin link N/A)";

		await channelData.send(`Global Twitch emotes changed: ${result.join("; ")} ${hastebinLink}`);
	})
};
