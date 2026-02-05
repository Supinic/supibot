import { declare } from "../../classes/command.js";

export default declare({
	Name: "knowyourmeme",
	Aliases: ["kym"],
	Cooldown: 30000,
	Description: "Gets a brief description of a meme from Know Your Meme, just the summary.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function knowYourMeme (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No search term provided!"
			};
		}

		const serachResponse = await core.Got.get("FakeAgent")({
			url: "https://knowyourmeme.com/search",
			searchParams: {
				q: args.join(" ")
			},
			responseType: "text"
		});

		const $search = core.Utils.cheerio(serachResponse.body);
		const firstLink = $search("a.item").attr("href");
		if (!firstLink) {
			return {
				success: false,
				reply: "No result found for given search term!"
			};
		}

		const detailResponse = await core.Got.get("FakeAgent")({
			prefixUrl: "https://knowyourmeme.com",
			url: firstLink.replace(/^\//, ""),
			responseType: "text"
		});

		const $detail = core.Utils.cheerio(detailResponse.body);
		const summary = $detail("#entry_body h2#about")
			.first()
			.next()
			.text();

		if (!summary) {
			return {
				success: false,
				reply: "No summary found for given meme!"
			};
		}

		const link = `https://knowyourmeme.com${firstLink}`;
		return {
			success: true,
			reply: `${link} ${summary}`
		};
	}),
	Dynamic_Description: null
});
