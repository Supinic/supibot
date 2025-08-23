import { SupiDate } from "supi-core";
import { declare } from "../../classes/command.js";
import * as z from "zod";

const NineGagData = z.object({
	data: z.object({
		posts: z.array(z.object({
			title: z.string().lowercase(),
			nsfw: z.literal([0, 1]),
			creationTs: z.int(),
			upVoteCount: z.int(),
			id: z.string()
		}))
	})
});

export default declare({
	Name: "9gag",
	Aliases: ["gag"],
	Cooldown: 10_000,
	Description: "Searches 9gag for posts that fit your search text, or a random featured one if you don't provide anything.",
	Flags: ["external-input", "mention", "non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: async function nineGag (context, ...args) {
		const options = (args.length === 0)
			? { url: "https://9gag.com/v1/group-posts/group/default/type/hot" }
			: {
				url: "https://9gag.com/v1/search-posts",
				searchParams: new URLSearchParams({
					query: args.join(" ")
				})
			};

		const response = await core.Got.get("GenericAPI")(options);
		const body = NineGagData.parse(response.body);

		const nsfw = Boolean(context.channel?.NSFW);
		const filteredPosts = (nsfw)
			? body.data.posts
			: body.data.posts.filter(i => i.nsfw !== 1);

		if (filteredPosts.length === 0) {
			return {
				success: false,
				reply: `No suitable posts found!`
			};
		}

		const post = core.Utils.randArray(filteredPosts);
		const delta = core.Utils.timeDelta(new SupiDate(post.creationTs * 1000));
		const title = core.Utils.fixHTML(post.title);
		return {
			reply: `${title} - https://9gag.com/gag/${post.id} - Score: ${post.upVoteCount}, posted ${delta}.`
		};
	},
	Dynamic_Description: (prefix) => [
		"Either searches 9gag for a post that matches your query, or posts a random one if you don't provide anything to search.",
		"",

		`<code>${prefix}9gag</code>`,
		"Fetches a recent random 9gag post.",
		"",

		`<code>${prefix}9gag (query)</code>`,
		"Fetches a recent random 9gag post that matches your query."
	]
});
