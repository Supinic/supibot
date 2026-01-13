import getLinkParser from "../../utils/link-parser.js";
import sharedKeys from "../../utils/shared-cache-keys.json" with { type: "json" };
import type { CronDefinition } from "../index.js";

const { SOUNDCLOUD_CLIENT_ID } = sharedKeys;
const fetchStatusCode = async (clientId: string): Promise<number> => {
	const response = await core.Got.get("GenericAPI")({
		url: "https://api-v2.soundcloud.com/resolve",
		throwHttpErrors: false,
		searchParams: {
			client_id: clientId,
			url: "https://soundcloud.com/terribleterrio/mararinha"
		}
	});

	return response.statusCode;
};

export default {
	name: "yoink-soundcloud-client-id",
	expression: "0 */30 * * * *",
	description: "\"Borrows\" the clientside Soundcloud API key to be used for TrackLinkParser module.",
	code: (async function yoinkSoundcloudClientID () {
		const cacheValue = await core.Cache.getByPrefix(SOUNDCLOUD_CLIENT_ID) as string | undefined;
		const soundcloudClientId = cacheValue ?? process.env.SOUNDCLOUD_CLIENT_ID;
		if (!soundcloudClientId) {
			this.stop();
			return;
		}

		if (await fetchStatusCode(soundcloudClientId) === 200) {
			return;
		}

		const mainPageResponse = await core.Got.get("FakeAgent")({
			url: "https://soundcloud.com",
			responseType: "text"
		});

		const $ = core.Utils.cheerio(mainPageResponse.body);
		const elements = $("body > script[crossorigin]");
		const scripts = [...elements].map(i => $(i).attr("src"));

		let finalClientID;
		for (const script of scripts) {
			const scriptResponse = await core.Got.get("FakeAgent")({
				url: script,
				responseType: "text"
			});

			const scriptSource = scriptResponse.body;
			const match = scriptSource.match(/client_id=(\w+?)\W/);
			if (!match) {
				continue;
			}

			const newClientId = match[1];
			if (await fetchStatusCode(newClientId) === 200) {
				finalClientID = newClientId;
				await core.Cache.setByPrefix(SOUNDCLOUD_CLIENT_ID, newClientId);
				break;
			}
		}

		if (finalClientID) {
			const linkParser = await getLinkParser();
			linkParser.reloadParser("soundcloud", { key: finalClientID });

			const channelData = sb.Channel.get("supinic", "twitch");
			if (channelData) {
				void channelData.send("Successfully updated soundcloud client");
			}
		}
		else {
			console.warn("Could not fetch Soundcloud client-id!");
		}
	})
} satisfies CronDefinition;
