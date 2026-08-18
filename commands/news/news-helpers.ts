import type { ParameterDefinition, ParamFromDefinition, ResultFailure } from "../../classes/command.js";
import { SupiDate } from "supi-core";

export const newsParams = [
	{ name: "country", type: "string" },
	{ name: "latest", type: "boolean" },
	{ name: "link", type: "boolean" },
	{ name: "period", type: "string" }
] as const satisfies ParameterDefinition[];

export const fetchEligibleArticle = <T extends { published: number }> (articles: T[], options: NewsOptions): { article: T } | ResultFailure => {
	let article;
	if (options.params.latest) {
		article = articles.sort((a, b) => b.published - a.published).at(0);
	}
	else if (options.params.period) {
		let threshold: number;
		const { period } = options.params;
		switch (period) {
			case "day": {
				threshold = new SupiDate().addDays(-1).valueOf();
				break;
			}
			case "week": {
				threshold = new SupiDate().addDays(-7).valueOf();
				break;
			}
			case "month": {
				threshold = new SupiDate().addDays(-30).valueOf();
				break;
			}
			case "year": {
				threshold = new SupiDate().addDays(-365).valueOf();
				break;
			}
			default: {
				return {
					success: false,
					reply: "Invalid period provided! Use one of day, week, month, year."
				};
			}
		}

		const eligibleArticles = articles.filter(i => i.published >= threshold);
		if (eligibleArticles.length === 0) {
			return {
				success: false,
				reply: "There are no articles that fit within your selected time period!"
			};
		}

		article = core.Utils.randArray(eligibleArticles);
	}
	else {
		article = core.Utils.randArray(articles);
	}

	if (!article) {
		return {
			success: false,
			reply: "No relevant articles found!"
		};
	}

	return { article };
};

type NewsParams = typeof newsParams;
export type NewsOptions = {
	params: ParamFromDefinition<NewsParams>,
	limit: number;
};
