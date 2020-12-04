module.exports = {
	Name: "yoink-soundcloud-client-id",
	Expression: "0 */10 * * * *",
	Description: "\"Borrows\" the clientside Soundcloud API key to be used for TrackLinkParser module.",
	Defer: null,
	Type: "All",
	Code: (async function yoinkSoundcloudClientID () {
		const { statusCode } = await sb.Got({
			url: "https://api-v2.soundcloud.com/resolve",
			searchParams: new sb.URLParams()
				.set("client_id", sb.Config.get("SOUNDCLOUD_CLIENT_ID"))
				.set("url", "https://soundcloud.com/terribleterrio/mararinha")
				.toString()
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
			const scriptSource = await sb.Got(script).text();
			const match = scriptSource.match(/client_id=(.*?)&/);
			if (!match) {
				continue;
			}

			const clientID = match[1];
			const { statusCode } = await sb.Got({
				url: "https://api-v2.soundcloud.com/resolve",
				searchParams: new sb.URLParams()
					.set("client_id", clientID)
					.set("url", "https://soundcloud.com/terribleterrio/mararinha")
					.toString()
			});

			if (statusCode === 200) {
				finalClientID = clientID;
				await sb.Config.set("SOUNDCLOUD_CLIENT_ID", clientID);
				break;
			}
		}

		if (finalClientID) {
			console.log("Successfully updated soundcloud client-id", { finalClientID });
			sb.Utils.linkParser.reloadParser("soundcloud", { key: finalClientID });
		}
		else {
			console.warn("Could not fetch Soundcloud client-id!");
		}
	})
};