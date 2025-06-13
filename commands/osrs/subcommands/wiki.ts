import { bindOsrsSubcommand } from "../index.js";

export default bindOsrsSubcommand({
	name: "wiki",
	title: "Search the Wiki",
	aliases: ["search"],
	default: true,
	description: [
		"<u>Search the Wiki</u>",
		`<code>$osrs search (query)</code>`,
		`Attempts to post a direct OSRS Wiki link to whatever you're looking for.`
	],
	execute: async function (context, ...args) {
		const search = args.join(" ");
		if (!search) {
			return {
				success: false,
				reply: `No input provided!`
			};
		}

		const response = await core.Got.get("GenericAPI")({
			url: "https://oldschool.runescape.wiki/w/Special:Search",
			responseType: "text",
			throwHttpErrors: false,
			searchParams: { search }
		});

		if (response.redirectUrls.length !== 0) {
			const $ = core.Utils.cheerio(response.body);
			const summary = $($("#mw-content-text > div > p")[0]).text();
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			const url = $("link[rel='canonical']")?.attr("href")?.replace("oldschool.runescape.wiki", "osrs.wiki") ?? "(no link)";

			return {
				reply: `${url} ${summary}`
			};
		}
		else {
			return {
				reply: `No direct match, try this search link: https://osrs.wiki/?search=${encodeURIComponent(search)}`
			};
		}
	}
});
