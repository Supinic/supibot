import * as z from "zod";
import { declare } from "../../classes/command.js";

const querySchema = z.object({
	data: z.object({
		randomPage: z.object({
			page: z.object({
				alternateTitles: z.array(z.object({ title: z.string() })),
				url: z.string(),
				wikidotInfo: z.object({ rating: z.int(), title: z.string() })
			})
		})
	})
});

export default declare({
	Name: "randomscp",
	Aliases: ["rscp"],
	Author: "caglapickaxe",
	Cooldown: 5000,
	Description: "Fetches a description of a random SCP from the SCP Foundation Wiki.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function randomSCP () {
		const response = await core.Got.gql({
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

		const { page } = querySchema.parse(response.body).data.randomPage;
		const url = new URL(page.url);
		if (url.protocol === "http:") {
			url.protocol = "https:";
		}

		const { rating } = page.wikidotInfo;
		const ratingString = (rating > 0)
			? `+${rating}`
			: String(rating);

		let { title } = page.wikidotInfo;
		if (page.alternateTitles.length > 0) {
			title += ` — ${page.alternateTitles.map(i => i.title).join(", ")}`;
		}

		return {
			reply: core.Utils.tag.trim `
				(${ratingString})
				${title}:
				${url.toString()}
			`
		};
	}),
	Dynamic_Description: null
});
