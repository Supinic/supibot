import * as z from "zod";
import { SupiDate } from "supi-core";
import { declare } from "../../classes/command.ts";

const mediaEntityShape = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("video"),
		video_info: z.object({
			variants: z.array(z.object({
				bitrate: z.number().optional(),
				url: z.string()
			}))
		})
	}),
	z.object({
		type: z.literal("photo"),
		media_url_https: z.string()
	}),
	z.object({
		type: z.literal("animated_gif")
	})
]);

const timelineSchema = z.object({
	data: z.object({
		timeline: z.array(z.object({
			_probably_pinned: z.boolean().optional(),
			created_at: z.string(),
			id_str: z.string(),
			full_text: z.string().nullish(),
			possibly_sensitive: z.boolean(),
			retweeted_status: z.object({}).optional(),
			entities: z.object({
				media: z.array(mediaEntityShape)
			})
		}))
	})
});

const extractMediaLinks = (mediaEntities: z.infer<typeof mediaEntityShape>[]): string[] => {
	const result = [];
	for (const item of mediaEntities) {
		if (item.type === "video") {
			const { variants } = item.video_info;
			const [bestVariant] = variants.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));

			result.push(bestVariant.url);
		}
		else if (item.type === "photo") {
			result.push(item.media_url_https);
		}
	}

	return result;
};

export default declare({
	Name: "twitter",
	Aliases: ["tweet"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the last tweet from a given user. No retweets or replies, just plain standalone tweets.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [
		{ name: "includeReplies", type: "boolean" },
		{ name: "includeRetweets", type: "boolean" },
		{ name: "imageOnly", type: "boolean" },
		{ name: "mediaOnly", type: "boolean" },
		{ name: "random", type: "boolean" },
		{ name: "textOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function twitter (context, input) {
		const searchParams = (context.params.includeReplies)
			? { includeReplies: true }
			: {};

		const response = await core.Got.get("Supinic")({
			url: `twitter/syndication/${encodeURI(input)}`,
			searchParams
		});

		if (response.statusCode === 404) {
			return {
				success: false,
				reply: `No such user exists!`
			};
		}
		else if (!response.ok) {
			return {
				success: false,
				reply: `That user's tweets are not available!`
			};
		}

		const { timeline } = timelineSchema.parse(response.body).data;

		let eligibleTweets = timeline.filter(i => i._probably_pinned !== true);
		if (context.params.mediaOnly) {
			eligibleTweets = eligibleTweets.filter(i => Array.isArray(i.entities.media) && i.entities.media.length !== 0);
			if (eligibleTweets.length === 0) {
				return {
					success: false,
					reply: `There are no recent tweets that have any kind of media attached to them!`
				};
			}
		}

		if (context.params.imageOnly) {
			eligibleTweets = eligibleTweets.filter(i => (
				Array.isArray(i.entities.media)
				&& i.entities.media.every(j => j.type === "photo")
			));

			if (eligibleTweets.length === 0) {
				return {
					success: false,
					reply: `There are no recent tweets that have any images attached to them!`
				};
			}
		}

		if (!context.params.includeRetweets) {
			eligibleTweets = eligibleTweets.filter(i => !i.retweeted_status);
			if (eligibleTweets.length === 0) {
				return {
					success: false,
					reply: `There are no recent tweets that are not retweets!`
				};
			}
		}

		let isSensitiveContentAllowed;
		if (!context.channel) {
			isSensitiveContentAllowed = true;
		}
		else {
			isSensitiveContentAllowed = (context.channel.NSFW)
				? true
				: Boolean(await context.channel.getDataProperty("twitterNSFW"));
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
			tweet = core.Utils.randArray(eligibleTweets);
		}
		else {
			tweet = eligibleTweets.at(0);
		}

		if (!tweet) {
			return {
				success: false,
				reply: "That account has not tweeted so far."
			};
		}

		const replyUrl = (context.params.includeReplies) ? `https://twitter.com/${input}/status/${tweet.id_str}` : "";
		const delta = core.Utils.timeDelta(new SupiDate(tweet.created_at));
		const fullText = core.Utils.fixHTML(tweet.full_text ?? "");
		const fixedText = `${fullText} ${replyUrl}`;

		if (context.params.mediaOnly) {
			const links = extractMediaLinks(tweet.entities.media).join(" ");
			return {
				success: true,
				reply: (context.params.textOnly)
					? links
					: `${fixedText} ${links} (posted ${delta})`
			};
		}
		else {
			return {
				success: true,
				reply: (context.params.textOnly)
					? fixedText
					: `${fixedText} (posted ${delta})`
			};
		}
	}),
	Dynamic_Description: (prefix) => [
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

		`<code>${prefix}twitter imageOnly:true (account)</code>`,
		"Only includes tweets that have some media and all of it is images (photos).",
		"Tweets with no media and tweets with any videos will be filtered out.",
		"This will also filter out tweets that contain images, but have at least 1 video.",
		"",

		`<code>${prefix}twitter textOnly:true (account)</code>`,
		"Gets the text of the last tweet only - without the date of posting and all other descriptions that come with the command",
		"",

		`<code>${prefix}twitter textOnly:true mediaOnly:true (account)</code>`,
		"Filters out all tweets that contain no media, and only posts the link(s) to the media in a given tweet.",
		""
	]
});
