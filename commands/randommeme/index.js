import config from "./config.json" with { type: "json" };
import Subreddit from "./subreddit.js";

let redditGotInstance;
const redditGot = (...args) => {
	const options = {
		prefixUrl: "https://www.reddit.com/r/",
		throwHttpErrors: false,
		headers: {
			Cookie: "_options={%22pref_quarantine_optin%22:true,%22pref_gated_sr_optin%22:true};"
		}
	};

	if (process.env.API_REDDIT_USERNAME && process.env.API_REDDIT_SECRET) {
		options.username = process.env.API_REDDIT_USERNAME;
		options.password = process.env.API_REDDIT_SECRET;
	}
	else {
		console.log("$rm command will not use authorized requests - no credentials found");
	}

	redditGotInstance ??= sb.Got.get("GenericAPI").extend(options);
	return redditGotInstance(...args);
};

export default {
	Name: "randommeme",
	Aliases: ["rm"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "If no parameters are provided, posts a random Reddit meme. If you provide a subreddit, a post will be chosen randomly.",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: [
		{ name: "comments", type: "boolean" },
		{ name: "flair", type: "string" },
		{ name: "galleryLinks", type: "boolean" },
		{ name: "ignoreFlair", type: "string" },
		{ name: "linkOnly", type: "boolean" },
		{ name: "rawData", type: "boolean" },
		{ name: "showFlairs", type: "boolean" },
		{ name: "skipGalleries", type: "boolean" },
		{ name: "skipVideos", type: "boolean" }
	],
	initialize: function () {
		this.data.subreddits = {};
	},
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

		const input = (args.shift() ?? sb.Utils.randArray(config.defaultMemeSubreddits));
		let subreddit = encodeURIComponent(input.toLowerCase());

		/** @type {Subreddit} */
		let forum = this.data.subreddits[subreddit];
		if (!forum) {
			const response = await redditGot(`${subreddit}/about.json`);
			const { body, statusCode } = response;

			if (statusCode === 403) {
				return {
					success: false,
					reply: `Reddit is currently overloaded! Try again later.`
				};
			}
			else if (statusCode !== 200 && statusCode !== 404) {
				throw new sb.Error.GenericRequest({
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
			else {
				// override the subreddit name in case of uncached subreddits. if it isn't overridden,
				// the original name (e.g. "random") stays, and the posts request is rolled randomly again,
				// creating a de-synchronization between the random roll and the result.
				subreddit = forum.name;
			}
		}

		if (forum.error || forum.reason) {
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
		else if (forum.nsfw && context.append.pipe) {
			return {
				success: false,
				reason: "pipe-nsfw"
			};
		}

		if (forum.posts.length === 0 || sb.Date.now() > forum.expiration) {
			const response = await redditGot(`${subreddit}/hot.json`);
			const { statusCode, body } = response;

			if (statusCode === 403) {
				return {
					success: false,
					reply: `Reddit is currently overloaded! Try again later.`
				};
			}
			else if (statusCode !== 200) {
				throw new sb.Error.GenericRequest({
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
		let clearRepeatedPosts;
		if (context.channel) {
			this.data.repeatedChannelPostsMap ??= {};
			this.data.repeatedChannelPostsMap[context.channel.ID] ??= [];

			repeatedPosts = this.data.repeatedChannelPostsMap[context.channel.ID];
			clearRepeatedPosts = () => {
				this.data.repeatedChannelPostsMap[context.channel.ID] = [];
			};
		}
		else {
			this.data.repeatedPrivateMessagePostsMap ??= {};
			this.data.repeatedPrivateMessagePostsMap[context.user.ID] ??= [];

			repeatedPosts = this.data.repeatedPrivateMessagePostsMap[context.user.ID];
			clearRepeatedPosts = () => {
				this.data.repeatedPrivateMessagePostsMap[context.user.ID] = [];
			};
		}

		const { posts } = forum;
		let validPosts = posts.filter(i => (
			!i.stickied
			&& !i.isSelftext
			&& !i.isTextPost
			&& !repeatedPosts.includes(i.id)
			&& !i.removed_by_category // potentially signifies deleted posts if set
			&& !i.removal_reason // also potentially signifies removed posts if set
		));

		if (validPosts.length === 0) {
			if (repeatedPosts.length !== 0) {
				clearRepeatedPosts();
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
				clearRepeatedPosts();
				return {
					success: false,
					reply: `Subreddit ${input} only has NSFW posts! This channel is marked as SFW posts only.`
				};
			}
		}
		if (context.params.flair) {
			validPosts = validPosts.filter(i => i.hasFlair(context.params.flair, false));
			if (validPosts.length === 0) {
				clearRepeatedPosts();
				return {
					success: false,
					reply: `Subreddit ${input} has no posts with the flair ${context.params.flair}!`
				};
			}
		}
		if (context.params.ignoreFlair) {
			validPosts = validPosts.filter(i => !i.hasFlair(context.params.ignoreFlair, false));
			if (validPosts.length === 0) {
				clearRepeatedPosts();
				return {
					success: false,
					reply: `Subreddit ${input} has no posts that don't have the flair ${context.params.ignoreFlair}!`
				};
			}
		}
		if (context.params.skipGalleries) {
			validPosts = validPosts.filter(i => !i.hasGallery());
			if (validPosts.length === 0) {
				clearRepeatedPosts();
				return {
					success: false,
					reply: `Subreddit ${input} has no posts that are not galleries!`
				};
			}
		}
		if (context.params.skipVideos) {
			validPosts = validPosts.filter(i => !i.hasVideo());
			if (validPosts.length === 0) {
				clearRepeatedPosts();
				return {
					success: false,
					reply: `Subreddit ${input} has no posts that are not videos!`
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

		// Add the currently used post ID at the beginning of the array
		repeatedPosts.unshift(post.id);
		// And then splice off everything over the length of 3.
		repeatedPosts.splice(config.repeats);

		if (context.params.rawData) {
			return {
				reply: "Data is available.",
				data: {
					post: post.toJSON()
				}
			};
		}
		else if (context.params.linkOnly) {
			return {
				reply: post.url
			};
		}

		const galleryLinksString = (context.params.galleryLinks && post.hasGalleryLinks())
			? post.getGalleryLinks().join(" ")
			: "";
		const commentsUrl = (context.params.comments)
			? `Thread: https://reddit.com/${post.commentsUrl}`
			: "";

		const symbol = (forum.quarantine) ? "⚠" : "";
		const postString = (context.platform.Name === "discord" && post.isVideoPost)
			? `https://reddit.com/${post.commentsUrl}`
			: post.toString();

		return {
			reply: sb.Utils.fixHTML(`${symbol} r/${forum.name}: ${postString} ${commentsUrl} ${galleryLinksString}`)
		};
	}),
	Dynamic_Description: (async function (prefix) {
		return [
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
			`<code>${config.defaultMemeSubreddits.join(" ")}</code>`,
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
		];
	})
};
