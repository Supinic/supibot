module.exports = {
	Name: "randominstagram",
	Aliases: ["rig"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a random Instagram user's post, from their most recently posted ones.",
	Flags: ["mention","non-nullable","use-params"],
	Params: [
		{ name: "rawLinkOnly", type: "boolean" },
		{ name: "postLinkOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomInstagram (context, user) {
		if (!user) {
			return {
				success: false,
				reply: "You must input a valid profile name!"
			};
		}

		user = user.toLowerCase();

		let statusCode;
		let data;
		const profileCacheData = await this.getCacheData({ user });
		if (profileCacheData) {
			statusCode = profileCacheData.statusCode;
			data = profileCacheData.data;
		}
		else {
			let redirected = false;
			const response = await sb.Got("FakeAgent", {
				url: `https://www.instagram.com/${user}/`,
				searchParams: {
					__a: "1"
				},
				throwHttpErrors: false,
				responseType: "json",
				hooks: {
					beforeRedirect: [
						(options, res) => {
							if (res.statusCode >= 300 && res.statusCode <= 399) {
								redirected = true;
							}
						}
					]
				}
			});

			if (redirected) {
				const backup = await sb.Got(`https://bibliogram.art/u/${user}`);
				const $ = sb.Utils.cheerio(backup.body);

				const posts = Array.from($("a.sized-link")).map(i => ({
					id: i.attribs["data-shortcode"],
					description: i.children[0].attribs.alt,
					raw: unescape(i.children[0].attribs.src).split("&url=")[1]
				}));

				const post = sb.Utils.randArray(posts);
				if (context.params.rawLinkOnly) {
					return {
						reply: post.raw
					};
				}
				else if (context.params.postLinkOnly) {
					return {
						reply: `https://www.instagram.com/p/${post.id}`
					};
				}
				else {
					return {
						reply: `
							Backup Instagram source:
							${post.description}
							https://www.instagram.com/p/${post.id}
						`
					};
				}
			}

			statusCode = response.statusCode;
			data = response.body;

			await this.setCacheData({ user }, { statusCode, data }, {
				expiry: 36e5
			});
		}

		if (statusCode === 404) {
			return {
				success: false,
				reply: `User "${user}" not found on Instagram!`
			};
		}
		else if (!data.graphql) {
			return {
				success: false,
				reply: `No posts data received for user "${user}"!`
			};
		}

		const nsfwCheck = (!context.channel || (!context.channel.NSFW && !context.channel.Data.instagramNSFW));
		const posts = (data.graphql.user.edge_owner_to_timeline_media?.edges ?? []).filter(i => !i.node.is_video);
		if (posts.length === 0) {
			return {
				success: false,
				reply: `User "${user}" does not have any picture posts available!`
			};
		}

		const post = sb.Utils.randArray(posts).node;
		const description = post.accessibility_caption;
		const commentCount = post.edge_media_to_comment.count ?? 0;
		const likeCount = post.edge_liked_by.count ?? 0;

		if (nsfwCheck) {
			const nsfwCacheKey = { post: post.shortcode };
			let nsfwData = await this.getCacheData(nsfwCacheKey);
			if (!nsfwData) {
				const response = await sb.Utils.checkPictureNSFW(post.display_url);
				if (response.statusCode !== 200) {
					return {
						success: false,
						reply: `Fetching image data failed! Error: ${response.statusCode}`
					};
				}

				nsfwData = response.data;
				await this.getCacheData(nsfwCacheKey, response.data, {
					expiry: 30 * 864e5 // 1 month
				});
			}

			const relevantDetections = nsfwData.detections.filter(i => !i.name.includes("Covered"));
			if (nsfwData.score > 0.25 || relevantDetections.length > 0) {
				const score = sb.Utils.round(nsfwData.score * 100, 2);
				return {
					success: false,
					reply: sb.Utils.tag.trim `
						This post from "${post.owner.username}" was deemed to be too NSFW for this channel!
						NSFW score: ${score}%,
						detections: ${relevantDetections.length}
					`
				};
			}
		}

		if (context.params.rawLinkOnly) {
			return {
				reply: post.display_url
			};
		}
		else if (context.params.postLinkOnly) {
			return {
				reply: `https://www.instagram.com/p/${post.shortcode}`
			};
		}
		else {
			return {
				reply: `
					Random post from "${post.owner.username}":
					${description}
					(${commentCount} comments, ${likeCount} likes)
					https://www.instagram.com/p/${post.shortcode}
				`
			};
		}
	}),
	Dynamic_Description: (async (prefix) => [
		"For a given Instagram user, this command fetches one of their recent 12 posts.",
		"Video posts are skipped, for the moment being.",
		"If this command isn't invoked in an NSFW-compliant channel, the command will only post pictures if they pass the NSFW check.",
		`If you would like to the disable this filter (at your own risk!), channel owners and ambassadors can use the <code>${prefix}set/unset rig-nsfw</code> command. For more info, check that command's description.`,
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
	])
};
