import * as z from "zod";
import rawConfig from "./config.json" with { type: "json" };
import { filterNonNullable } from "../../utils/ts-helpers.js";
import type { ResultFailure } from "../../classes/command.js";

const configShape = z.object({
	repeats: z.number(),
	// r/random, r/randnsfw and adjacent subreddits were removed on 2024-09-24 due to being "low-usage"
	// source: https://old.reddit.com/r/help/comments/1fojw02
	// uncached: z.array(z.string()),
	banned: z.array(z.string()),
	defaultMemeSubreddits: z.array(z.string())
});
export const redditConfig = configShape.parse(rawConfig);

const subredditSchema = z.union([
	z.object({
		data: z.object({ after: z.null() })
	}),
	z.object({
		data: z.object({
			display_name: z.string(),
			quarantine: z.boolean().optional(),
			over18: z.boolean().optional()
		})
	})
]);

const postShape = z.object({
	id: z.string(),
	title: z.string(),
	url: z.string(),
	author: z.string(),
	selftext: z.string(),
	selftext_html: z.string().nullish(),
	stickied: z.boolean(),
	over_18: z.boolean(),
	is_video: z.boolean(),
	is_gallery: z.boolean().optional(),
	gallery_data: z.object({
		items: z.array(z.object({
			media_id: z.string()
		}))
	}).optional(),
	media_metadata: z.record(z.string(), z.object({
		status: z.string(),
		m: z.string().optional()
	})).nullish(),
	created: z.number(),
	created_utc: z.number(),
	score: z.number().optional(), // posts can have hidden score
	subreddit: z.string(),
	subreddit_name_prefixed: z.string(),
	removal_reason: z.unknown(),
	removed_by_category: z.unknown(),
	link_flair_richtext: z.array(z.object({
		e: z.string(),
		t: z.string().optional()
	})),
	get crosspost_parent_list () { return z.array(postShape).optional(); }
});
const postsSchema = z.object({
	data: z.object({
		children: z.array(z.object({
			data: postShape
		}))
	})
});

type Subreddit = {
	name: string;
	quarantine: boolean;
	nsfw: boolean;
	posts: RedditPost[];
};
type RedditPost = {
	id: string;
	title: string;
	url: string;
	commentsUrl: string;
	author: string;
	created: number;
	flairs: string[];
	nsfw: boolean;
	stickied: boolean;
	isTextPost: boolean;
	isGallery: boolean;
	isVideo: boolean;
	score: number;
	galleryLinks: string[];
	crosspostOrigin: string | null;
	removed: boolean;
};
type RawRedditPost = {
	id: string;
	title: string;
	url: string;
	commentsUrl: string;
	author: string;
	created: number;
	flairs: string[];
	nsfw: boolean;
	stickied: boolean;
	isTextPost: boolean;
	isGallery: boolean;
	isVideo: boolean;
	score: number;
	galleryLinks: string[];
	crosspostOrigin: string | null;
};

const DEFAULT_EXPIRATION = 36e5; // 1 hour
const parsePost = (data: z.infer<typeof postShape>): RedditPost => {
	const { title } = data;

	let crosspostNSFW: boolean = false;
	let crosspostOrigin: string | null = null;
	if (data.crosspost_parent_list && data.crosspost_parent_list.length > 0) {
		const [crosspost] = data.crosspost_parent_list;

		crosspostNSFW = data.over_18;
		crosspostOrigin = crosspost.subreddit_name_prefixed;
		data = crosspost;
	}

	const commentsUrl = `r/${data.subreddit}/comments/${data.id}`;
	const flairs = filterNonNullable(
		data.link_flair_richtext
			.filter(i => i.e === "text")
			.map(i => {
				if (!i.t) {
					return null;
				}

				return core.Utils.fixHTML(i.t.trim()).toLowerCase();
			})
	);

	const galleryLinks = [];
	if (data.is_gallery && data.gallery_data && data.media_metadata) {
		const meta = data.media_metadata;
		for (const item of data.gallery_data.items) {
			const id = item.media_id;
			if (!(id in meta)) {
				continue;
			}

			const itemMeta = meta[id];
			if (itemMeta.status !== "valid" || !itemMeta.m) {
				continue;
			}

			const mime = itemMeta.m;
			const ext = mime.split("/")[1];
			const link = `https://i.redd.it/${item.media_id}.${ext}`;

			galleryLinks.push(link);
		}
	}

	return {
		id: data.id,
		url: data.url,
		title,
		author: data.author,
		isTextPost: Boolean(data.selftext && data.selftext_html),
		isVideo: Boolean(data.is_video),
		isGallery: Boolean(data.is_gallery),
		nsfw: Boolean(data.over_18) || crosspostNSFW,
		stickied: Boolean(data.stickied),
		score: data.score ?? 0,
		created: data.created * 1000,
		removed: Boolean(data.removed_by_category) || Boolean(data.removal_reason),
		commentsUrl,
		flairs,
		crosspostOrigin,
		galleryLinks
	};
};

export const getRawRedditPost = (post: RedditPost): RawRedditPost => ({
	id: post.id,
	url: post.url,
	title: post.title,
	author: post.author,
	isTextPost: post.isTextPost,
	isVideo: post.isVideo,
	isGallery: post.isGallery,
	nsfw: post.nsfw,
	stickied: post.stickied,
	score: post.score,
	created: post.created,
	commentsUrl: post.commentsUrl,
	flairs: post.flairs,
	crosspostOrigin: post.crosspostOrigin,
	galleryLinks: post.galleryLinks
});

type SubredditSuccess = {
	success: true;
	subreddit: Subreddit;
};
const createSubredditKey = (name: string) => `cache-subreddit-${name}`;
export const getSubreddit = async (name: string): Promise<SubredditSuccess | ResultFailure> => {
	const key = createSubredditKey(name);
	const cachedData = await core.Cache.getByPrefix(key) as Subreddit | undefined;
	if (cachedData) {
		return {
			success: true,
			subreddit: cachedData
		};
	}

	const aboutResponse = await core.Got.get("Reddit")({
		url: `${name}/about.json`
	});

	if (aboutResponse.statusCode === 403) {
		return {
			success: false,
			reply: `Reddit is currently overloaded! Try again later.`
		};
	}
	else if (aboutResponse.statusCode === 404) {
		// specific to banned subreddits; yes, banned subreddits are 404 and non-existing ones are 200 (see below)
		return {
			success: false,
			reply: `Subreddit ${name} is banned or otherwise not available!`
		};
	}
	else if (aboutResponse.statusCode !== 200) {
		return {
			success: false,
			reply: `Reddit responded with error ${aboutResponse.statusCode}! Try again later.`
		};
	}

	const rawAboutData = subredditSchema.parse(aboutResponse.body);
	if ("after" in rawAboutData) {
		return {
			success: false,
			reply: `There is no subreddit with that name!`
		};
	}

	const postsResponse = await core.Got.get("Reddit")({
		url: `${name}/hot.json`
	});

	if (postsResponse.statusCode !== 200) {
		return {
			success: false,
			reply: `Reddit responded with error ${postsResponse.statusCode}! Try again later.`
		};
	}

	const aboutData = rawAboutData.data;
	const rawPostsData = postsSchema.parse(postsResponse.body).data.children;
	const posts = rawPostsData.map(i => parsePost(i.data));
	const subreddit = {
		name: aboutData.display_name,
		quarantine: Boolean(aboutData.quarantine),
		nsfw: Boolean(aboutData.over18),
		posts
	};

	await core.Cache.setByPrefix(key, subreddit, {
		expiry: DEFAULT_EXPIRATION
	});

	return {
		success: true,
		subreddit
	};
};
