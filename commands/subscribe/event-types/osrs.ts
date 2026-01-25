import * as z from "zod";
import type { CustomEventDefinition } from "../generic-event.js";
import { SupiError } from "supi-core";

const jagexRssSchema = z.object({
	newsItems: z.array(z.object({
		newsId: z.int(),
		categoryId: z.int(),
		time: z.string(), // timestamp (with millis)
		formattedDate: z.string(), // DD (full month) YYYY
		title: z.string(),
		link: z.string(),
		summary: z.string(),
		summaryImageLink: z.string(),
		largeMediaType: z.int(),
		sticky: z.boolean()
	}))
});

const url = "https://secure.runescape.com/m=news/latestNews.json?oldschool=1";
const OSRS_LATEST_ARTICLE_ID = "osrs-last-article-id-list";
const SLIDING_CACHE_SIZE = 20000;

type OsrsResponse = {
	newsItems: {
		newsId: number;
		link: string;
		summary: string;
		time: string;
		title: string;
		sticky: boolean;
	}[];
};

export default {
	name: "OSRS",
	aliases: [],
	notes: "Every minute, Supibot checks for news on the Old School Runescape website. If a new article is detected, you will be notified in the channel you subscribed in.",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new OSRS article is published.",
		removed: "You will no longer receive pings when a new OSRS article is published."
	},
	generic: true,
	cronExpression: "0 */1 * * * *",
	subName: "OSRS article",
	type: "custom",
	process: async () => {
		const response = await core.Got.get("GenericAPI")<OsrsResponse>({
			url,
			responseType: "json",
			throwHttpErrors: true
		});

		if (!response.ok) {
			return null;
		}

		const { newsItems } = jagexRssSchema.parse(response.body);
		const previousArticleIdList = (await core.Cache.getByPrefix(OSRS_LATEST_ARTICLE_ID) as number[] | null) ?? [];

		const previousArticleIds = new Set(previousArticleIdList);
		const currentArticleIds = new Set(newsItems.map(i => i.newsId));

		const cacheArray = [...previousArticleIds.union(currentArticleIds)]
			.sort((a, b) => b - a)
			.slice(0, SLIDING_CACHE_SIZE);

		await core.Cache.setByPrefix(OSRS_LATEST_ARTICLE_ID, cacheArray, {
			expiry: 14 * 864e5 // 14 days
		});

		// Grab article IDs not in the previous list
		const newArticleIds = currentArticleIds.difference(previousArticleIds);
		if (newArticleIds.size === 0) {
			// If no new articles, exit out
			return null;
		}

		const intersection = previousArticleIds.intersection(currentArticleIds);
		if (intersection.size === 0) {
			// If there is no overlap at all between previous and current news IDs, exit out
			// This means the previous set is either very outdated or not initialized at all
			return null;
		}

		const newArticles = newsItems.filter(i => newArticleIds.has(i.newsId));
		if (newArticles.length === 0) {
			// Should never happen due to conditions above
			throw new SupiError({
			    message: "Assert error: No eligible articles filtered",
				args: { ids: [...newArticleIds] }
			});
		}

		// Safeguard for accidental multi-article notification
		if (newArticles.length > 3) {
			return null;
		}

		const articleString = newArticles.map(i => `${i.title} ${i.link}`).join(" -- ");
		const noun = (newArticles.length === 1) ? "article" : "articles";

		await sb.Logger.log("System.Request", JSON.stringify({
			previousArticleIds: [...previousArticleIds],
			newArticleIds: [...newArticleIds],
			currentArticleIds: [...currentArticleIds],
			articleString
		}));

		return {
			message: `New OSRS ${noun}! ${articleString}`
		};
	}
} satisfies CustomEventDefinition;
