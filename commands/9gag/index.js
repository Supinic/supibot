module.exports = {
	Name: "9gag",
	Aliases: ["gag"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Searches 9gag for posts that fit your search text, or a random featured one if you don't provide anything.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function gag (context, ...args) {
		const options = { responseType: "json" };
		if (args.length === 0) {
			options.url = "https://9gag.com/v1/group-posts/group/default/type/hot";
		}
		else {
			options.url = "https://9gag.com/v1/search-posts";
			options.searchParams = new sb.URLParams()
				.set("query", args.join(" "))
				.toString();
		}
	
		const { statusCode, body } = await sb.Got(options);
		if (statusCode !== 200) {
			return {
				success: false,
				reply: `9GAG API returned error ${statusCode}!`
			};
		}
	
		const nsfw = Boolean(context?.channel.NSFW);
		const filtered = (nsfw)
			? body.data.posts
			: body.data.posts.filter(i => i.nsfw !== 1);
	
		const post = sb.Utils.randArray(filtered);
		if (!post) {
			return {
				success: false,
				reply: `No suitable posts found!`
			};
		}
	
		const delta = sb.Utils.timeDelta(new sb.Date(post.creationTs * 1000));
		return {
			reply: `${post.title} - ${post.url} - Score: ${post.upVoteCount}, posted ${delta}.`
		};
	}),
	Dynamic_Description: null
};