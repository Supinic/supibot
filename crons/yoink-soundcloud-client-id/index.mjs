import { getLinkParser } from "../../utils/link-parser.js";

export const definition = {
	name: "yoink-soundcloud-client-id",
	expression: "0 */10 * * * *",
	description: "\"Borrows\" the clientside Soundcloud API key to be used for TrackLinkParser module.",
	code: (async function yoinkSoundcloudClientID (cron) {
		if (!sb.Config.has("SOUNDCLOUD_CLIENT_ID")) {
			cron.job.stop();
		}

		const { statusCode } = await sb.Got("GenericAPI", {
			url: "https://api-v2.soundcloud.com/resolve",
			throwHttpErrors: false,
			searchParams: {
				client_id: sb.Config.get("SOUNDCLOUD_CLIENT_ID"),
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

			const clientID = match[1];
			const { statusCode } = await sb.Got("GenericAPI", {
				url: "https://api-v2.soundcloud.com/resolve",
				throwHttpErrors: false,
				searchParams: {
					client_id: clientID,
					url: "https://soundcloud.com/terribleterrio/mararinha"
				}
			});

			if (statusCode === 200) {
				finalClientID = clientID;
				await sb.Config.set("SOUNDCLOUD_CLIENT_ID", clientID, sb.Query);
				break;
			}
		}

		if (finalClientID) {
			console.log("Successfully updated soundcloud client-id", { finalClientID });

			const linkParser = getLinkParser();
			linkParser.reloadParser("soundcloud", { key: finalClientID });
		}
		else {
			console.warn("Could not fetch Soundcloud client-id!");
		}
	})
};
