export default {
	Name: "knowyourmeme",
	Aliases: ["kym"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Gets a smol description of a meme from Know Your Meme, it's just the summary.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function knowYourMeme (context, ...args) {
		if (args.length === 0) {
			return {
				reply: "No search term provided!"
			};
		}

		const searchHTML = await sb.Got.get("FakeAgent")({
			url: "https://knowyourmeme.com/search",
			searchParams: {
				q: args.join(" ")
			},
			responseType: "text"
		}).text();

		const $search = sb.Utils.cheerio(searchHTML);
		const firstLink = $search(".entry_list a").first().attr("href");
		if (!firstLink) {
			return {
				reply: "No result found for given search term!"
			};
		}

		const detailHTML = await sb.Got.get("FakeAgent")({
			prefixUrl: "https://knowyourmeme.com",
			url: firstLink.replace(/^\//, ""),
			responseType: "text"
		}).text();

		const $detail = sb.Utils.cheerio(detailHTML);
		const summary = $detail("#entry_body h2#about")
			.first()
			.next()
			.text();

		if (!summary) {
			return {
				reply: "No summary found for given meme!"
			};
		}

		const link = `https://knowyourmeme.com${firstLink}`;
		return {
			reply: `${link} ${summary}`
		};
	}),
	Dynamic_Description: null
};
