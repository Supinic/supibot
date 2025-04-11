import { CustomEventDefinition } from "../generic-event.js";

const url = "https://secure.runescape.com/m=news/latestNews.json?oldschool=1";
const OSRS_LATEST_ARTICLE_ID = "osrs-last-article-id";

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
	notes: "Every 5 minutes, Supibot checks for news on the Old School Runescape website. If a new article is detected, you will be notified in the channel you subscribed in.",
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

		const newsItems = response.body.newsItems.filter(i => !i.sticky);
		const previousArticleId = (await core.Cache.getByPrefix(OSRS_LATEST_ARTICLE_ID) as number | null) ?? 0;

		// Huge assumption: Jagex will release new articles on "top" of the JSON feed
		const previousArticleIndex = newsItems.findIndex(i => i.newsId === previousArticleId);
		const logObject = {
			newsItems,
			previousArticleId,
			previousArticleIndex
		};

		// Ignore if no previous article found - save the latest one
		if (previousArticleIndex === -1) {
			const topArticleId = newsItems[0].newsId;
			await core.Cache.setByPrefix(OSRS_LATEST_ARTICLE_ID, topArticleId, {
				expiry: 14 * 864e5 // 14 days
			});
			//
			// await sb.Logger.log("System.Request", JSON.stringify({
			// 	...logObject,
			// 	topArticleId
			// }));

			return null;
		}
		// Ignore if feed head equals to the latest article (no new articles)
		else if (previousArticleIndex === 0) {
			// await sb.Logger.log("System.Request", JSON.stringify(logObject));
			return null;
		}

		const eligibleArticles = newsItems.slice(0, previousArticleIndex);
		const latestArticleId = eligibleArticles[0].newsId;

		await core.Cache.setByPrefix(OSRS_LATEST_ARTICLE_ID, latestArticleId, {
			expiry: 14 * 864e5 // 14 days
		});

		// Safeguard for accidental multi-article notification
		if (eligibleArticles.length > 3) {
			return null;
		}

		const articleString = eligibleArticles.map(i => `${i.title} ${i.link}`).join(" -- ");
		const noun = (eligibleArticles.length === 1) ? "article" : "articles";

		await sb.Logger.log("System.Request", JSON.stringify({
			...logObject,
			latestArticleId,
			eligibleArticles,
			articleString
		}));

		return {
			message: `New OSRS ${noun}! ${articleString}`
		};
	}
} satisfies CustomEventDefinition;
