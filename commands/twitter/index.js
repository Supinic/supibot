module.exports = {
	Name: "twitter",
	Aliases: ["tweet"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the last tweet from a given user. No retweets or replies, just plain standalone tweets.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "includeReplies", type: "boolean" },
		{ name: "includeRetweets", type: "boolean" },
		{ name: "mediaOnly", type: "boolean" },
		{ name: "random", type: "boolean" },
		{ name: "textOnly", type: "boolean" },
		{ name: "trends", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function twitter (context, input) {
		if (context.params.trends) {
			return {
				success: false,
				reply: `Trends are not supported after Twitter API change!`
			};
		}
		else if (context.params.includeReplies) {
			return {
				success: false,
				reply: `Replies are not supported after Twitter API change!`
			};
		}

		const response = await sb.Got("Supinic", {
			url: `twitter/timeline/${encodeURI(input)}`
		});

		let eligibleTweets = response.body.timeline;
		if (context.params.mediaOnly) {
			eligibleTweets = eligibleTweets.filter(i => Array.isArray(i.entities.media) && i.entities.media.length !== 0);
			if (eligibleTweets.length === 0) {
				return {
					success: false,
					reply: `There are no recent tweets that have any kind of media attached to them!`
				};
			}
		}

		let isSensitiveContentAllowed = false;
		if (!context.channel) {
			isSensitiveContentAllowed = true;
		}
		else {
			if (context.channel.NSFW) {
				isSensitiveContentAllowed = true;
			}

			isSensitiveContentAllowed = Boolean(await context.channel.getDataProperty("twitterNSFW"));
		}

		if (!isSensitiveContentAllowed) {
			eligibleTweets = eligibleTweets.filter(i => !i.possibly_sensitive);

			if (eligibleTweets.length === 0) {
				return {
					success: false,
					reply: `There are no recent tweets that are not marked as sensitive (NSFW) content!`
				};
			}
		}

		let tweet;
		if (context.params.random) {
			tweet = sb.Utils.randArray(eligibleTweets);
		}
		else {
			tweet = eligibleTweets[0];
		}

		if (!tweet) {
			return {
				reply: "That account has not tweeted so far."
			};
		}

		const replyUrl = (context.params.includeReplies) ? `https://twitter.com/${user}/status/${tweet.id_str}` : "";
		const delta = sb.Utils.timeDelta(new sb.Date(tweet.created_at));
		const fullText = sb.Utils.fixHTML(tweet.full_text ?? "");
		const fixedText = `${fullText} ${replyUrl}`;

		if (context.params.mediaOnly) {
			const links = tweet.entities.media.map(i => i.media_url_https).join(" ");
			return {
				reply: (context.params.textOnly)
					? links
					: `${fixedText} ${links} (posted ${delta})`
			};
		}
		else {
			return {
				reply: (context.params.textOnly)
					? fixedText
					: `${fixedText} (posted ${delta})`
			};
		}
	}),
	Dynamic_Description: async (prefix) => [
		"Fetches the last tweet of a provided account.",
		"Excludes retweets by default - this can be changed with a parameter.",
		"",

		"If the post has sensitive content in it (determined by Twitter), it will not be posted outside of a NSFW channel.",
		"All channels are not NSFW by default - except for explicit NSFW channels on Discord.",
		`This check can be disabled - at the channel owner's (or ambassador's) risk - via the <a href="/bot/command/detail/set">$set twitter-nsfw</a> command. Check it for more info.`,
		"",

		`<code>${prefix}tweet (account)</code>`,
		`<code>${prefix}twitter (account)</code>`,
		"Gets the last tweet.",
		"",

		`<code>${prefix}twitter trends:(location)</code>`,
		`<code>${prefix}twitter trends:France</code>`,
		`<code>${prefix}twitter trends:PL</code>`,
		`<code>${prefix}twitter trends:"United Arab Emirates"</code>`,
		"Fetches the top 10 trending hashtags for a given country, either as full name or code.",
		"",

		`<code>${prefix}twitter random:true (account)</code>`,
		"Instead of fetching the last tweet, fetches a random tweet from the account's recent history (up to 200 tweets)",
		"",

		`<code>${prefix}twitter includeReplies:true (account)</code>`,
		"Gets the last tweet or a reply to another tweet.",
		"",

		`<code>${prefix}twitter includeRetweets:true (account)</code>`,
		"Gets the last tweet, including retweets.",
		"",

		`<code>${prefix}twitter mediaOnly:true (account)</code>`,
		"Filters out all tweets that contain no media.",
		"",

		`<code>${prefix}twitter textOnly:true (account)</code>`,
		"Gets the text of the last tweet only - without the date of posting and all other descriptions that come with the command",
		"",

		`<code>${prefix}twitter textOnly:true mediaOnly:true (account)</code>`,
		"Filters out all tweets that contain no media, and only posts the link(s) to the media in a given tweet.",
		""
	]
};
