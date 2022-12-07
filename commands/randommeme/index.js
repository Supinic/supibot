module.exports = {
	Name: "randommeme",
	Aliases: ["rm"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "If no parameters are provided, posts a random Reddit meme. If you provide a subreddit, a post will be chosen randomly. NSFW subreddits and posts are only available on NSFW Discord channels!",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: [
		{ name: "comments", type: "boolean" },
		{ name: "flair", type: "string" },
		{ name: "ignoreFlair", type: "string" },
		{ name: "linkOnly", type: "boolean" },
		{ name: "safeMode", type: "boolean" },
		{ name: "showFlairs", type: "boolean" },
		{ name: "skipGalleries", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomMeme (context, ...args) {
		const config = require("./config.json");
		const Subreddit = require("./subreddit.js");

		this.data.subreddits ??= {};

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

		const input = (args.shift() ?? sb.Utils.randArray(config.defaultMemeSubreddits));
		const subreddit = encodeURIComponent(input.toLowerCase());

		/** @type {Subreddit} */
		let forum = this.data.subreddits[subreddit];
		if (!forum) {
			const { body, statusCode } = await sb.Got("Reddit", `${subreddit}/about.json`);

			if (statusCode !== 200 && statusCode !== 403 && statusCode !== 404) {
				throw new sb.errors.GenericRequestError({
					statusCode,
					hostname: "reddit.com",
					statusMessage: body.statusMessage ?? null,
					message: `Fetching ${subreddit}/about.json failed`,
					stack: null
				});
			}

			forum = new Subreddit(body);
			if (!config.uncached.includes(subreddit)) {
				this.data.subreddits[subreddit] = forum;
			}
		}

		if (forum.error) {
			return {
				success: false,
				reply: `Subreddit ${input} is ${forum.reason ?? "not available"}!`
			};
		}
		else if (!forum.exists) {
			return {
				success: false,
				reply: "There is no subreddit with that name!"
			};
		}
		else if (safeSpace && (config.banned.includes(forum.name) || forum.nsfw)) {
			return {
				success: false,
				reply: `Subreddit ${input} is flagged as 18+, and thus not safe to post here!`
			};
		}

		if (forum.posts.length === 0 || sb.Date.now() > forum.expiration) {
			const { statusCode, body } = await sb.Got("Reddit", `${subreddit}/hot.json`);
			if (statusCode !== 200) {
				throw new sb.errors.GenericRequestError({
					statusCode,
					hostname: "reddit.com",
					statusMessage: body.statusMessage ?? null,
					message: `Fetching ${subreddit}/hot.json failed`,
					stack: null
				});
			}

			forum.setExpiration();
			forum.addPosts(body.data.children);
		}

		if (context.params.showFlairs) {
			const flairs = forum.availableFlairs;
			return {
				reply: (flairs.size === 0)
					? "There are no flairs available in this subreddit."
					: `Available flairs for this subreddit: ${[...flairs].sort().join(", ")}`
			};
		}

		let repeatedPosts;
		if (context.channel) {
			this.data.repeatedChannelPostsMap ??= {};
			this.data.repeatedChannelPostsMap[context.channel.ID] ??= [];

			repeatedPosts = this.data.repeatedChannelPostsMap[context.channel.ID];
		}
		else {
			this.data.repeatedPrivateMessagePostsMap ??= {};
			this.data.repeatedPrivateMessagePostsMap[context.user.ID] ??= [];

			repeatedPosts = this.data.repeatedPrivateMessagePostsMap[context.user.ID];
		}

		const { posts } = forum;
		let validPosts = posts.filter(i => (
			!i.stickied
			&& !i.isSelftext
			&& !i.isTextPost
			&& !repeatedPosts.includes(i.id)
		));

		if (validPosts.length === 0) {
			if (repeatedPosts.length === 0) {
				forum.repeatedPosts = [];
				return {
					success: false,
					reply: "Front page posts have all been posted! ♻ If you try again, you will receive repeated results."
				};
			}
			else {
				return {
					success: false,
					reply: `Subreddit ${input} has no eligible (not stickied, self or text) posts!`
				};
			}
		}
		
		if (safeSpace) {
			validPosts = posts.filter(i => !i.nsfw);
			if (validPosts.length === 0) {
				return {
					success: false,
					reply: `Subreddit ${input} has non-NSFW posts! This channel is marked as non-NSFW posts only.`
				};
			}
		}
		if (context.params.flair) {
			validPosts = posts.filter(i => i.hasFlair(context.params.flair, false));
			if (validPosts.length === 0) {
				return {
					success: false,
					reply: `Subreddit ${input} has no posts with the flair ${context.params.flair}!`
				};
			}
		}
		if (context.params.ignoreFlair) {
			validPosts = posts.filter(i => !i.hasFlair(context.params.ignoreFlair, false));
			if (validPosts.length === 0) {
				return {
					success: false,
					reply: `Subreddit ${input} has no posts that don't have the flair ${context.params.ignoreFlair}!`
				};
			}
		}
		if (context.params.skipGalleries) {
			validPosts = posts.filter(i => !i.hasGallery());
			if (validPosts.length === 0) {
				return {
					success: false,
					reply: `Subreddit ${input} has no posts that are not galleries!`
				};
			}
		}

		const post = sb.Utils.randArray(validPosts);
		if (!post) {
			return {
				success: false,
				reply: `No eligible post found! This should not happen though, please contact @Supinic`
			};
		}
		else {
			if ((config.banned.includes(forum.name) || post.nsfw) && context.append.pipe) {
				return {
					success: false,
					reason: "pipe-nsfw"
				};
			}

			// Add the currently used post ID at the beginning of the array
			repeatedPosts.unshift(post.id);
			// And then splice off everything over the length of 3.
			repeatedPosts.splice(config.repeats);

			if (context.params.linkOnly) {
				return {
					reply: post.url
				};
			}

			const commentsUrl = (context.params.comments)
				? `Thread: https://reddit.com/${post.commentsUrl}`
				: "";

			const symbol = (forum.quarantine) ? "⚠" : "";
			const postString = (context.platform.Name === "discord" && post.isVideoPost)
				? `https://reddit.com/${post.commentsUrl}`
				: post.toString();

			return {
				reply: sb.Utils.fixHTML(`${symbol} r/${forum.name}: ${postString} ${commentsUrl}`)
			};
		}
	}),
	Dynamic_Description: (async function (prefix) {
		const { defaultMemeSubreddits } = require("./config.json");
		return [
			"Posts a random Reddit meme. If a subreddit is provided, posts a random non-text post from there.",
			"",

			"This command filters out NSFW content!",
			"In a non-NSFW channel, or in private messages:",
			"If the subreddit was marked as NSFW, the command will fail.",
			"All NSFW posts will be filtered out, even if that means nothing can be posted.",
			"",

			"All channels are non-NSFW by default - except for explicit NSFW channels on Discord.",
			`This check can be disabled - at the channel owner's (or ambassador's) risk - via the <a href="/bot/command/detail/set>$set reddit-nsfw</a> command. Check it for more info.`,
			"",

			`<code>${prefix}rm</code>`,
			`<code>${prefix}randommeme</code>`,
			"Posts a random post from one of the default meme subreddits.",
			`<code>${defaultMemeSubreddits.join(" ")}</code>`,
			"",

			`<code>${prefix}rm (subreddit)</code>`,
			`<code>${prefix}randommeme (subreddit)</code>`,
			"Posts a random post from the specified subreddit.",
			"NSFW-marked subreddits are not available outside of channels marked for that content.",
			"NSFW-marked posts will be filtered out in channels not marked for that content.",
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
			"As before, but all links that are a Reddit gallery will be skipped and not posted."
		];
	})
};
