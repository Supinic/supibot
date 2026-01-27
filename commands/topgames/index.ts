import * as z from "zod";
import { declare } from "../../classes/command.js";

const querySchema = z.array(z.object({
	data: z.object({
		directoriesWithTags: z.object({
			edges: z.array(z.object({
				node: z.object({
					displayName: z.string(),
					id: z.string(),
					name: z.string(),
					slug: z.string(),
					viewersCount: z.int()
				})
			}))
		})
	})
}));

export default declare({
	Name: "topgames",
	Aliases: null,
	Cooldown: 30000,
	Description: "Fetches the top 10 most popular games on Twitch, based on current viewer count.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: async function topGames () {
		const response = await core.Got.get("TwitchGQL")({
			responseType: "json",
			headers: {
				Referer: "https://www.twitch.tv/"
			},
			body: JSON.stringify([{
				extensions: {
					persistedQuery: {
						version: 1,
						sha256Hash: "2f67f71ba89f3c0ed26a141ec00da1defecb2303595f5cda4298169549783d9e"
					}
				},
				variables: {
					limit: 10,
					options: {
						sort: "VIEWER_COUNT"
					}
				}
			}])
		});

		const games = querySchema.parse(response.body)[0].data.directoriesWithTags.edges;
		const string = games.map(({ node }) => {
			const shortNumber = `${Math.floor(node.viewersCount / 1000)}k`;
			return `${node.displayName} (${shortNumber})`;
		}).join(", ");

		return {
			success: true,
			reply: `Current top categories on Twitch: ${string}`
		};
	},
	Dynamic_Description: null
});
