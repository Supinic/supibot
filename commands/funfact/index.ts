import * as z from "zod";
import { SupiDate } from "supi-core";
import { declare } from "../../classes/command.js";
import { randomInt } from "../../utils/command-utils.js";

const previousPosts = new Map<number, string>();
const querySchema = z.array(z.object({
	_id: z.string(),
	createdAt: z.iso.datetime(),
	title: z.string(),
	validated: z.boolean()
}));

export default declare({
	Name: "funfact",
	Aliases: ["ff"],
	Cooldown: 10000,
	Description: "Fetches a random fun fact. Absolutely not guaranteed to be fun or fact.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [{ name: "type", type: "string" }],
	Whitelist_Response: null,
	Code: (async function funFact (context) {
		const { year } = new SupiDate();
		const randomDate = new SupiDate(
			randomInt(2017, year),
			randomInt(1, 12)
		);

		// @todo this API supports multiple endpoints for various categories: Interesting, Funny, Animal, Chuck Norris, etc.
		const response = await core.Got.get("GenericAPI")({
			responseType: "json",
			url: "https://uselessfacts.net/api/posts",
			searchParams: `d=${randomDate.toJSON()}`
		});

		let posts = querySchema.parse(response.body);
		if (context.channel) {
			const previousPost = previousPosts.get(context.channel.ID);
			if (previousPost) {
				posts = posts.filter(i => i._id !== previousPost);
			}
		}

		if (posts.length === 0) {
			return {
				success: false,
				reply: "No fun facts found! Try again later."
			};
		}

		const post = core.Utils.randArray(posts);
		if (context.channel) {
			previousPosts.set(context.channel.ID, post._id);
		}

		return {
			success: true,
			reply: post.title
		};
	}),
	Dynamic_Description: null
});
