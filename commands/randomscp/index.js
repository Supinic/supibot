module.exports = {
	Name: "randomscp",
	Aliases: ["rscp"],
	Author: "caglapickaxe",
	Cooldown: 7500,
	Description: "Fetches a random SCP.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomSCP () {
		const response = await sb.Got.gql({
			url: "https://api.crom.avn.sh/graphql",
			query: `{
				randomPage (filter: {
					anyBaseUrl: "http://scp-wiki.wikidot.com"
					allTags: "scp"
				}) {
					page {
						alternateTitles {
							title
						}
						url
						wikidotInfo {
							rating
							title
						}
					}
				}
			}`
		});

		const { page } = response.body.data.randomPage;

		const url = new URL(page.url);
		if (url.protocol === "http:") {
			url.protocol = "https:";
		}

		let { rating, title } = page.wikidotInfo;
		if (rating > 0) {
			rating = `+${rating}`;
		}

		if (page.alternateTitles.length > 0) {
			title += ` — ${page.alternateTitles.map(i => i.title).join(", ")}`;
		}
		title += ":";

		return {
			reply: sb.Utils.tag.trim `
				(${rating})
				${title}
				${url}
			`
		};
	}),
	Dynamic_Description: null
};
