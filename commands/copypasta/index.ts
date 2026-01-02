import { declare } from "../../classes/command.js";
import { asciiArtRegex, brailleRegex } from "../../utils/regexes.js";

const MAXIMUM_REPEATS = 5;

const fetchCopypasta = async () => {
	const response = await core.Got.get("FakeAgent")({
		url: "https://www.twitchquotes.com/random",
		responseType: "text"
	});

	const $ = core.Utils.cheerio(response.body);
	const text = $("span.-main-text").text();

	return core.Utils.removeHTML(text).trim();
};

const hasAsciiArt = (string: string) => (asciiArtRegex.test(string) || brailleRegex.test(string));

export default declare({
	Name: "copypasta",
	Aliases: null,
	Cooldown: 15000,
	Description: "Fetches a random Twitch-related copypasta.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function copypasta () {
		let copypasta;
		for (let repeats = 0; repeats < MAXIMUM_REPEATS; repeats++) {
			const result = await fetchCopypasta();

			if (result && !hasAsciiArt(result)) {
				copypasta = result;
				break;
			}
		}

		if (!copypasta) {
			return {
				success: false,
				reply: `Could not find a fitting copypasta within ${MAXIMUM_REPEATS} attempts!`
			};
		}

		return {
			reply: `Your copypasta: ${copypasta}`
		};
	}),
	Dynamic_Description: (prefix) => [
		`Fetches a random Twitch copypasta from <a href="//twitchquotes.com">twitchquotes.com</a>.`,
		"This command automatically excludes copypastas that contain some kind of ASCII or Braille characters art",
		"",

		`<code>${prefix}copypasta</code>`,
		"(random copypasta)"
	]
});
