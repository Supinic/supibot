module.exports = {
	fetch: async (query) => {
		const searchParams = {
			language: "en"
		};

		if (query.length !== 0) {
			searchParams.keywords = query;
		}

		let response;
		try {
			response = await sb.Got("GenericAPI", {
				url: "https://api.currentsapi.services/v1/search",
				searchParams,
				headers: {
					Authorization: sb.Config.get("API_CURRENTSAPI_TOKEN")
				},
				throwHttpErros: false,
				responseType: "json",
				retry: {
					limit: 0
				},
				timeout: {
					request: 2500
				}
			});
		}
		catch (e) {
			if (e instanceof sb.Got.TimeoutError || e instanceof sb.errors.GenericRequestError) {
				return {
					success: false,
					reply: (query)
						? "No relevant news articles found for your query!"
						: "There are no news available right now!"
				};
			}
			else {
				throw e;
			}
		}

		const { news } = response.body;
		if (!news) {
			return {
				success: false,
				reply: "No news data returned!"
			};
		}
		else if (news.length === 0) {
			return {
				success: false,
				reply: "No relevant articles found!"
			};
		}

		const { description = "", published, title } = sb.Utils.randArray(news);
		const separator = (title && description) ? " - " : "";
		const delta = (published)
			? `(published ${sb.Utils.timeDelta(new sb.Date(published))})`
			: "";

		return {
			reply: sb.Utils.removeHTML(`${title}${separator}${description} ${delta}`)
		};
	}
};
