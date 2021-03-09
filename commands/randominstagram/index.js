module.exports = {
	Name: "randominstagram",
	Aliases: ["rig"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a random Instagram user's post, from their most recently posted ones.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomInstagram (context, user) {
		if (!user) {
			return {
				success: false,
				reply: `Pepega`
			};
		}

		const { statusCode, body: data } = await sb.Got("FakeAgent", {
			url: `https://www.instagram.com/${user}/`,
			searchParams: {
				"__a": "1"
			},
			throwHttpErrors: false,
			responseType: "json"
		});

		if (statusCode === 404) {
			return {
				success: false,
				reply: `No such user found!`
			};
		}

		const nsfwCheck = (!context.channel || !context.channel.NSFW);
		const posts = (data.graphql.user.edge_owner_to_timeline_media?.edges ?? []).filter(i => !i.node.is_video);
		if (posts.length === 0) {
			return {
				success: false,
				reply: `No relevant picture posts were found!`
			};
		}

		const post = sb.Utils.randArray(posts).node;
		const description = post.accessibility_caption;
		const commentCount = post.edge_media_to_comment.count ?? 0;
		const likeCount = post.edge_liked_by.count ?? 0;

		const { statusCode: nsfwStatusCode, data: nsfwData } = await sb.Utils.checkPictureNSFW(`https://i.imgur.com/${image.Link}`);
		if (nsfwStatusCode !== 200) {
			return {
				success: false,
				reply: `Fetching image data failed! Error: ${nsfwStatusCode}`
			};
		}

		const relevantDetections = nsfwData.detections.filter(i => !i.name.includes("Covered"));
		if (nsfwCheck && nsfwData.score > 0.25 || relevantDetections.length > 0) {
			return {
				success: false,
				reply: `That post was deemed to be too NSFW for this channel!`
			};
		}

		return {
			reply: `
				Random post from ${post.owner.username}:
				${description}
				(${commentCount} comments, ${likeCount} likes)
				${post.display_url}
			`
		};
	}),
	Dynamic_Description: null
};