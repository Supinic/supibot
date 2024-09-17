import { getLinkParser } from "../../utils/link-parser.js";

import sharedKeys from "../../utils/shared-cache-keys.json" with { type: "json" };
const { SOUNDCLOUD_CLIENT_ID } = sharedKeys;

export const definition = {
	name: "yoink-soundcloud-client-id",
	expression: "0 */10 * * * *",
	description: "\"Borrows\" the clientside Soundcloud API key to be used for TrackLinkParser module.",
	code: (async function yoinkSoundcloudClientID (cron) {
		const soundcloudClientId = await sb.Cache.getByPrefix(SOUNDCLOUD_CLIENT_ID) ?? process.env.SOUNDCLOUD_CLIENT_ID;
		if (!soundcloudClientId) {
			console.debug("No initial Soundcloud Client ID configured - stopping cron (SOUNDCLOUD_CLIENT_ID)");
			cron.job.stop();
			return;
		}

		const { statusCode } = await sb.Got("GenericAPI", {
			url: "https://api-v2.soundcloud.com/resolve",
			throwHttpErrors: false,
			searchParams: {
				client_id: soundcloudClientId,
				url: "https://soundcloud.com/terribleterrio/mararinha"
			}
		});

		if (statusCode === 200) {
			return;
		}

		const mainPage = await sb.Got("https://soundcloud.com").text();
		const $ = sb.Utils.cheerio(mainPage);

		let finalClientID;
		const elements = $("body > script[crossorigin]");
		const scripts = Array.from(elements).map(i => $(i).attr("src"));
		for (const script of scripts) {
			const scriptResponse = await sb.Got("FakeAgent", {
				url: script,
				responseType: "text"
			});

			const scriptSource = scriptResponse.body;

			const match = scriptSource.match(/client_id=(\w+?)\W/);
			if (!match) {
				continue;
			}

			const newClientId = match[1];
			const { statusCode } = await sb.Got("GenericAPI", {
				url: "https://api-v2.soundcloud.com/resolve",
				throwHttpErrors: false,
				searchParams: {
					client_id: newClientId,
					url: "https://soundcloud.com/terribleterrio/mararinha"
				}
			});

			if (statusCode === 200) {
				finalClientID = newClientId;
				await sb.Cache.setByPrefix(SOUNDCLOUD_CLIENT_ID, newClientId);
				break;
			}
		}

		if (finalClientID) {
			console.log("Successfully updated soundcloud client-id", { finalClientID });

			const linkParser = await getLinkParser();
			linkParser.reloadParser("soundcloud", { key: finalClientID });
		}
		else {
			console.warn("Could not fetch Soundcloud client-id!");
		}
	})
};
