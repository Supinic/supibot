const { parseRSS } = require("../../../utils/command-utils.js");
const { createHash } = require("crypto");

const hashArticle = (item) => createHash("sha256")
	.update(item.title)
	.update(item.link)
	.update(item.content)
	.digest()
	.toString("hex");

const url = "https://secure.runescape.com/m=news/latest_news.rss?oldschool=true";
const OSRS_LAST_ARTICLE_KEY = "osrs-last-article";

module.exports = {
	name: "OSRS",
	aliases: [],
	notes: "Every 5 minutes, Supibot checks for news on the Old School Runescape website. If a new article is detected, you will be notified in the channel you subscribed in.",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new OSRS article is published.",
		removed: "You will no longer receive pings when a new OSRS article is published."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	subName: "OSRS article",
	type: "custom",
	process: async () => {
		const xml = await sb.Got("GenericAPI", {
			url,
			responseType: "text"
		});

		const { items } = await parseRSS(xml.body);

		const eligibleArticles = [];
		const latestArticleHash = await sb.Cache.getByPrefix(OSRS_LAST_ARTICLE_KEY);
		if (latestArticleHash) {
			for (const article of items) {
				const hash = hashArticle(article);
				if (hash === latestArticleHash) {
					break;
				}

				eligibleArticles.push(article);
			}
		}
		else {
			eligibleArticles.push(items[0]);
		}

		if (eligibleArticles.length === 0) {
			return;
		}

		const newHash = hashArticle(eligibleArticles[0]);
		await sb.Cache.setByPrefix(OSRS_LAST_ARTICLE_KEY, newHash);

		const articleString = eligibleArticles.map(i => `${i.title} ${i.link}`).join(" -- ");
		const noun = (eligibleArticles.length === 0) ? "article" : "articles";
		return {
			message: `New OSRS ${noun}! ${articleString}`
		};
	}
};
