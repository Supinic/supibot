import { declare } from "../../classes/command.js";
import { getRawRedditPost, getSubreddit, redditConfig } from "./reddit-utils.js";

const repeatedPostsMap = new Map<string, string[]>();

export default declare({
	Name: "randommeme",
	Aliases: ["rm"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "If no parameters are provided, posts a random Reddit meme. If you provide a subreddit, a post will be chosen randomly.",
	Flags: ["external-input", "mention", "non-nullable", "pipe"],
	Params: [
		{ name: "comments", type: "boolean" },
		{ name: "flair", type: "string" },
		{ name: "galleryLinks", type: "boolean" },
		{ name: "ignoreFlair", type: "string" },
		{ name: "linkOnly", type: "boolean" },
		{ name: "rawData", type: "boolean" },
		{ name: "skipGalleries", type: "boolean" },
		{ name: "skipVideos", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function randomMeme (context, ...args) {
		let safeSpace = false;
		if (context.platform.Name === "twitch") {
			if (context.channel) {
				const unsafeMode = await context.channel.getDataProperty("redditNSFW");
				safeSpace = (typeof unsafeMode === "boolean") ? (!unsafeMode) : true;
			}
			else {
				safeSpace = true;
			}
		}
		else if (!context.channel?.NSFW && !context.privateMessage) {
			safeSpace = true;
		}

		const input = args.at(0) ?? core.Utils.randArray(redditConfig.defaultMemeSubreddits);
		const subredditName = encodeURIComponent(input.toLowerCase());
		const result = await getSubreddit(subredditName);
		if (!result.success) {
			return result;
		}

		const { subreddit } = result;
		if (safeSpace && (redditConfig.banned.includes(subreddit.name) || subreddit.nsfw)) {
			return {
				success: false,
				reply: `Subreddit ${input} is flagged as 18+, and thus not safe to post here!`
			};
		}
		else if (subreddit.nsfw && context.append.pipe) {
			return {
				success: false,
				reason: "pipe-nsfw"
			};
		}

		const repeatedPostKey = (context.channel)
			? `C-${context.channel.ID}`
			: `PM-${context.user.ID}`;

		// @todo use Map.prototype.getOrInsert once stable in Node (v27 probably)
		let repeatedPosts = repeatedPostsMap.get(repeatedPostKey);
		if (!repeatedPosts) {
			repeatedPosts = [];
			repeatedPostsMap.set(repeatedPostKey, repeatedPosts);
		}

		const { posts } = subreddit;
		let validPosts = posts.filter(i => (
			!i.stickied
			&& !i.isTextPost
			&& !repeatedPosts.includes(i.id)
			&& !i.removed
		));

		if (validPosts.length === 0) {
			if (repeatedPosts.length !== 0) {
				repeatedPostsMap.delete(repeatedPostKey);
				return {
					success: false,
					reply: "Front page posts have all been posted! ♻ If you try again, you will receive repeated results."
				};
			}
			else {
				return {
					success: false,
					reply: `Subreddit ${input} has no eligible (non-stickied, self or text) posts!`
				};
			}
		}

		if (safeSpace) {
			validPosts = validPosts.filter(i => !i.nsfw);
			if (validPosts.length === 0) {
				repeatedPostsMap.delete(repeatedPostKey);
				return {
					success: false,
					reply: `Subreddit ${input} only has NSFW posts! This channel is marked as SFW posts only.`
				};
			}
		}
		if (context.params.flair) {
			const lower = context.params.flair.toLowerCase();
			validPosts = validPosts.filter(i => i.flairs.includes(lower));

			if (validPosts.length === 0) {
				repeatedPostsMap.delete(repeatedPostKey);
				return {
					success: false,
					reply: `Subreddit ${input} has no posts with the flair ${context.params.flair}!`
				};
			}
		}
		if (context.params.ignoreFlair) {
			const lower = context.params.ignoreFlair.toLowerCase();
			validPosts = validPosts.filter(i => !i.flairs.includes(lower));

			if (validPosts.length === 0) {
				repeatedPostsMap.delete(repeatedPostKey);
				return {
					success: false,
					reply: `Subreddit ${input} has no posts that don't have the flair ${context.params.ignoreFlair}!`
				};
			}
		}
		if (context.params.skipGalleries) {
			validPosts = validPosts.filter(i => i.galleryLinks.length === 0);
			if (validPosts.length === 0) {
				repeatedPostsMap.delete(repeatedPostKey);
				return {
					success: false,
					reply: `Subreddit ${input} has no posts that are not galleries!`
				};
			}
		}
		if (context.params.skipVideos) {
			validPosts = validPosts.filter(i => !i.isVideo);
			if (validPosts.length === 0) {
				repeatedPostsMap.delete(repeatedPostKey);
				return {
					success: false,
					reply: `Subreddit ${input} has no posts that are not videos!`
				};
			}
		}

		if (validPosts.length === 0) {
			return {
				success: false,
				reply: `No eligible post found! This should not happen though, please contact @Supinic`
			};
		}

		const post = core.Utils.randArray(validPosts);
		// Add the currently used post ID at the beginning of the array
		repeatedPosts.unshift(post.id);
		// And then splice off everything over the length of 3.
		repeatedPosts.splice(redditConfig.repeats);

		if (context.params.rawData) {
			return {
				success: true,
				reply: "Data is available.",
				data: {
					post: getRawRedditPost(post)
				}
			};
		}
		else if (context.params.linkOnly) {
			return {
				success: true,
				reply: post.url
			};
		}

		const galleryLinksString = (context.params.galleryLinks && post.galleryLinks.length !== 0)
			? post.galleryLinks.join(" ")
			: "";

		let fixedUrl = `https://redd.it/${post.id}`;
		if (post.isGallery || post.isVideo) {
			fixedUrl += ` ${post.url}`;
		}

		const delta = core.Utils.timeDelta(post.created);
		const xpost = (post.crosspostOrigin) ? `, x-posted from ${post.crosspostOrigin}` : "";
		const commentsUrl = (context.params.comments) ? `Thread: https://reddit.com/${post.commentsUrl}` : "";
		const symbol = (subreddit.quarantine) ? "⚠" : "";
		return {
			success: true,
			reply: core.Utils.fixHTML(core.Utils.tag.trim `
				${symbol}
				r/${subreddit.name}:
				${post.title} ${fixedUrl} (Score: ${post.score}, posted ${delta}${xpost})
				${commentsUrl}
				${galleryLinksString}
			`)
		};
	}),
	Dynamic_Description: (prefix) => [
		"Posts a random Reddit meme. If a subreddit is provided, posts a random non-text post from there.",
		"",

		"This command filters out NSFW content!",
		"In a non-NSFW channel, or in private messages:",
		"If the subreddit was marked as NSFW, the command will fail.",
		"All NSFW posts will be filtered out, even if that means nothing can be posted.",
		"",

		"All channels are non-NSFW by default - except for explicit NSFW channels on Discord.",
		`This check can be disabled - at the channel owner's (or ambassador's) risk - via the <a href="/bot/command/detail/set">$set reddit-nsfw</a> command. Check it for more info.`,
		"",

		`<code>${prefix}rm</code>`,
		`<code>${prefix}randommeme</code>`,
		"Posts a random post from one of the default meme subreddits.",
		`<code>${redditConfig.defaultMemeSubreddits.join(" ")}</code>`,
		"",

		`<code>${prefix}rm (subreddit)</code>`,
		`<code>${prefix}randommeme (subreddit)</code>`,
		"Posts a random post from the specified subreddit.",
		"NSFW-marked subreddits are not available outside of channels marked for that content.",
		"NSFW-marked posts will be filtered out in channels not marked for that content.",
		"",

		`<code>${prefix}rm (subreddit) galleryLinks:true</code>`,
		"If this parameter is provided as `true` and a post has a gallery associated with it, the command will return a list of all images in the gallery as media posts.",
		"",

		`<code>${prefix}rm (subreddit) flair:(flair)</code>`,
		"If a flair is provided, only the posts that contain such flair will be used (case-insensitive).",
		"",

		`<code>${prefix}rm (subreddit) ignoreFlair:(flair)</code>`,
		"The opposite of <code>flair</code>, only the posts that do not contain such flair will be used (case-insensitive).",
		"",

		`<code>${prefix}rm (subreddit) showFlairs:true</code>`,
		"Posts a list of available flairs for given subreddit.",
		"",

		`<code>${prefix}rm linkOnly:true</code>`,
		`<code>${prefix}rm (subreddit) linkOnly:true</code>`,
		"Posts a random post from the default, or specified subreddit, posting just the link without any other text.",
		"",

		`<code>${prefix}rm skipGalleries:true</code>`,
		"As before, but all links that are a Reddit gallery will be skipped and not posted.",
		"",

		`<code>${prefix}rm skipVideos:true</code>`,
		"As before, but all links that are a Reddit video or a YouTube link will be skipped over.",
		""
	]
});
