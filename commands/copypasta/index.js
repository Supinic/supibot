module.exports = {
	Name: "copypasta",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Fetches a random Twitch-related copypasta. The date of creation usually ranges from 2014-2015.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "textOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		repeatLimit: 5,
		fetch: async () => {
			const html = await sb.Got("https://www.twitchquotes.com/random").text();
			const $ = sb.Utils.cheerio(html);

			return $(`div[id^="clipboard_copy_content"]`).text();
		},
		hasAsciiArt: (string) => {
			const brailleRegex = /[█▄▀░▒▓\u2802-\u28ff]/g;
			const asciiRegex = sb.Config.get("ASCII_ART_REGEX");

			return string.test(brailleRegex) && string.test(asciiRegex);
		}
	})),
	Code: (async function copypasta (context) {
		const { fetch, hasAsciiArt, repeatLimit } = this.staticData;

		let copypasta;
		let repeats = 0;
		do {
			copypasta = await fetch();
			repeats++;			
		} while (context.params.textOnly && hasAsciiArt(copypasta) && repeats < repeatLimit);
		
		if (repeats >= repeatLimit) {
			return {
				success: false,
				reply: `Could not find a fitting copypasta within ${repeats} attempts!`
			};
		}
	
		return {
			success: Boolean(copypasta),
			reply: (copypasta)
				? sb.Utils.removeHTML(copypasta).trim()
				: "No copypasta found!"
		};
	}),
	Dynamic_Description: null
};