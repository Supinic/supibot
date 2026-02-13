import * as z from "zod";
import { declare } from "../../classes/command.js";
import { SupiDate } from "supi-core";

const querySchema = z.object({
	data: z.object({
		user: z.object({
			edge_owner_to_timeline_media: z.object({
				edges: z.array(z.object({
					node: z.object({
						display_url: z.string(),
						owner: z.object({ username: z.string() }),
						is_video: z.boolean(),
						accessibility_caption: z.string().optional(),
						edge_media_to_caption: z.object({
							edges: z.array(z.object({
								node: z.object({ text: z.string() })
							}))
						}),
						edge_media_to_comment: z.object({ count: z.int().nullish() }),
						edge_liked_by: z.object({ count: z.int().nullish() }),
						taken_at_timestamp: z.int(),
						shortcode: z.string()
					})
				}))
			}).optional()
		})
	})
});
type CacheData = z.infer<typeof querySchema>["data"]["user"];

const getCacheKey = (user: string) => `instagram-profile-data-${user}`;
const facebookAppId = "936619743392459";

export default declare({
	Name: "randominstagram",
	Aliases: ["rig"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a random Instagram user's post, from their most recently posted ones.",
	Flags: ["mention","non-nullable"],
	Params: [
		{ name: "rawLinkOnly", type: "boolean" },
		{ name: "postLinkOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function randomInstagram (context, user) {
		if (!user) {
			return {
				success: false,
				reply: "You must input a valid profile name!"
			};
		}

		user = user.toLowerCase();

		const key = getCacheKey(user);
		let data = await core.Cache.getByPrefix(key) as CacheData | false | null;
		if (data === false) {
			return {
				success: false,
				reply: `User "${user}" not found on Instagram!`
			};
		}
		else if (data === null) {
			const response = await core.Got.get("FakeAgent")({
				url: `https://i.instagram.com/api/v1/users/web_profile_info`,
				searchParams: {
					username: user
				},
				headers: {
					"X-IG-App-ID": facebookAppId,
					"Alt-Used": "i.instagram.com"
				},
				throwHttpErrors: false,
				responseType: "json"
			});

			if (response.statusCode === 404) {
				await core.Cache.setByPrefix(key, false, { expiry: 864e5 });
				return {
					success: false,
					reply: `User "${user}" not found on Instagram!`
				};
			}
			else if (!response.ok) {
				return {
					success: false,
					reply: `Instagram API does not allow any more requests now! Try again in several minutes.`
				};
			}

			data = querySchema.parse(response.body).data.user;
			await this.setCacheData({ user }, data, { expiry: 36e5 });
		}

		const posts = (data.edge_owner_to_timeline_media?.edges ?? []).filter(i => !i.node.is_video);
		if (posts.length === 0) {
			return {
				success: false,
				reply: `User "${user}" does not have any picture posts available!`
			};
		}

		const post = core.Utils.randArray(posts).node;
		const commentCount = post.edge_media_to_comment.count ?? 0;
		const likeCount = post.edge_liked_by.count ?? 0;
		const posted = new SupiDate(post.taken_at_timestamp * 1000);
		const delta = core.Utils.timeDelta(posted);

		let description = "(N/A)";
		const descItem = post.edge_media_to_caption.edges.at(0);
		if (descItem) {
			description = descItem.node.text;
		}
		else if (post.accessibility_caption) {
			description = post.accessibility_caption;
		}

		const baseUrl = "https://instagram.com";
		if (context.params.rawLinkOnly) {
			return {
				success: true,
				reply: post.display_url
			};
		}
		else if (context.params.postLinkOnly) {
			return {
				success: true,
				reply: `${baseUrl}/p/${post.shortcode}`
			};
		}
		else {
			return {
				success: true,
				reply: `
					Post from ${post.owner.username} (${delta})
					${baseUrl}/p/${post.shortcode}
					${description}
					(${commentCount} comments, ${likeCount} likes)
				`
			};
		}
	}),
	Dynamic_Description: (prefix) => [
		"For a given Instagram user, this command fetches one of their recent 12 posts.",
		"Video posts are skipped, for the moment being.",
		// "If this command isn't invoked in an NSFW-compliant channel, the command will only post pictures if they pass the NSFW check.",
		// `If you would like to the disable this filter (at your own risk!), channel owners and ambassadors can use the <code>${prefix}set/unset rig-nsfw</code> command. For more info, check that command's description.`,
		"",

		`<code>${prefix}randominstagram (user)</code>`,
		"Posts a random picture post from the provided user.",
		"",

		`<code>${prefix}rig (user) rawLinkOnly:true</code>`,
		"Posts a random picture post URL - the actual image URL Instagram uses, without the description.",
		"",

		`<code>${prefix}rig (user) postLinkOnly:true</code>`,
		"Posts a random picture post URL - without the description, and other fluff.",
		""
	]
});
