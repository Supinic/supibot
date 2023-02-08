module.exports = {
	name: "wiki",
	title: "Search the Wiki",
	aliases: ["search"],
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

		const response = await sb.Got("GenericAPI", {
			url: "https://oldschool.runescape.wiki/w/api.php",
			responseType: "text",
			throwHttpErrors: false,
			searchParams: { search }
		});

		if (response.redirectUrls.length !== 0) {
			const $ = sb.Utils.cheerio(response.body);
			const summary = $($("#mw-content-text p")[0]).text();
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
};
