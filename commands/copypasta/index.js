module.exports = {
	Name: "copypasta",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Fetches a random Twitch-related copypasta.",
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
			const asciiRegex = sb.Config.get("ASCII_ART_REGEX");
			const brailleRegex = /[█▄▀░▒▓\u2802-\u28ff]/g;

			return brailleRegex.test(string) || asciiRegex.test(string);
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
	Dynamic_Description: (async (prefix) => {
		return [
			`Fetches a random Twitch copypasta from <a href="//twitchquotes.com">twitchquotes.com</a>.`,
			"",

			`<code>${prefix}copypasta</code>`,
			"(random copypasta)",
			"",

			`<code>${prefix}copypasta textOnly:true</code>`,
			"(random copypasta) - excludes ASCII art pastas. Retries up to 5 times, if one isn't found, then fails."
		];
	})
};