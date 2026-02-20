import * as z from "zod";
import { SupiDate } from "supi-core";
import { declare } from "../../classes/command.js";

const scrapeDataRegex = /window\._config\s*=\s*JSON\.parse\s*\((.+)\).+?<\/script>/;
const nineGagSchema = z.object({
	data: z.object({
		posts: z.array(z.object({
			title: z.string(),
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
	Description: "Fetches a random featured post from the front page of 9GAG.",
	Flags: ["external-input", "mention", "non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: async function nineGag (context) {
		const response = await core.Got.get("GenericAPI")({
			url: "https://9gag.com",
			responseType: "text"
		});

		const match = response.body.match(scrapeDataRegex);
		if (!match) {
			return {
			    success: false,
			    reply: "Could not find any posts on 9GAG!"
			};
		}

		let rawData;
		try {
			const string = JSON.parse(match[1]) as string; // doubly encoded
			rawData = JSON.parse(string) as unknown;
		}
		catch {
			return {
			    success: false,
			    reply: "Could not parse the data from 9GAG's front page!"
			};
		}

		const nsfw = Boolean(context.channel?.NSFW);
		const { data } = nineGagSchema.parse(rawData);

		const noAdvertisingPosts = data.posts.filter(i => i.creationTs !== 0); // Advertising posts have timestamp = 0
		const filteredPosts = (nsfw)
			? noAdvertisingPosts
			: noAdvertisingPosts.filter(i => i.nsfw !== 1);

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
		"Posts a random featured post from the 9GAG frontpage.",
		"",

		`<code>${prefix}9gag</code>`,
		"Fetches a recent random frontpage 9GAG post."
	]
});
