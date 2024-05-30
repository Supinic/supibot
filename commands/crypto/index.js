module.exports = {
	Name: "crypto",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the latest price of a cryptocurrency. If none is provided, defaults to BTC.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function crypto (context, symbol = "BTC") {
		symbol = symbol.toUpperCase();

		const { body: data } = await sb.Got("GenericAPI", {
			url: "https://min-api.cryptocompare.com/data/price",
			searchParams: {
				fsym: symbol,
				tsyms: "USD,EUR"
			},
			timeout: {
				request: 10000
			},
			headers: {
				Authorization: `Apikey ${sb.Config.get("API_CRYPTO_COMPARE")}`
			}
		});

		if (data.Response === "Error") {
			return {
				reply: data.Message
			};
		}
		else if (!data.USD && !data.EUR) {
			return {
				reply: `No known prices found for that currency.`
			};
		}
		else {
			let url;
			if (!context.channel || context.channel.Links_Allowed) {
				try {
					const response = await sb.Got("Global", {
						method: "HEAD",
						url: `https://www.coindesk.com/price/${symbol.toLowerCase()}`,
						throwHttpErrors: false,
						timeout: {
							request: 10_000
						},
						retry: {
							limit: 0
						},
						headers: {
							Referer: "https://www.coindesk.com/"
						}
					});

					url = response.url;
				}
				catch (e) {
					url = null;
				}
			}

			const link = (url)
				? `Check recent history here: ${url}`
				: "";

			const usd = (data.USD) ? `$${data.USD}` : "";
			const eur = (data.EUR) ? `€${data.EUR}` : "";

			return {
				removeEmbeds: true,
				reply: `Current price of ${symbol}: ${usd} ${eur} ${link}`
			};
		}
	}),
	Dynamic_Description: null
};
