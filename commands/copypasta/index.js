const MAXIMUM_REPEATS = 5;

const fetchCopypasta = async () => {
	const response = await sb.Got.get("FakeAgent")({
		url: "https://www.twitchquotes.com/random"
	});

	const $ = sb.Utils.cheerio(response.body);
	const text = $("span.-main-text").text();

	if (typeof text === "string") {
		return sb.Utils.removeHTML(text).trim();
	}
	else {
		return text;
	}
};

const asciiRegex = /([\u2591\u2588\u2500\u2580\u2593\u2584\u2592])/g;
const brailleRegex = /[█▄▀░▒▓\u2802-\u28ff]/g;
const hasAsciiArt = (string) => (asciiRegex.test(string) || brailleRegex.test(string));

module.exports = {
	Name: "copypasta",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Fetches a random Twitch-related copypasta.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
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
	Dynamic_Description: (async (prefix) => [
		`Fetches a random Twitch copypasta from <a href="//twitchquotes.com">twitchquotes.com</a>.`,
		"",

		`<code>${prefix}copypasta</code>`,
		"(random copypasta)",
		"This automatically excludes copypastas that contain some kind of ASCII or Braille characters art"
	])
};
