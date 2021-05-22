module.exports = {
	Name: "crypto",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the latest price of a cryptocurrency.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function crypto (context, symbol = "BTC") {
		symbol = symbol.toUpperCase();

		const { body: data } = await sb.Got("GenericAPI", {
			url: "https://min-api.cryptocompare.com/data/price",
			searchParams: {
				fsym: symbol,
				tsyms: "USD,EUR"
			},
			timeout: 10000,
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
			let status = null;
			if (!context.channel || context.channel.Links_Allowed) {
				const response = await sb.Got("Global", {
					method: "HEAD",
					url: `https://www.coindesk.com/price/${symbol.toLowerCase()}`,
					throwHttpErrors: false,
					timeout: 2500,
					retry: 0
				});

				status = response.statusCode;
			}

			const link = (status === 200)
				? `Check recent history here: https://www.coindesk.com/price/${symbol.toLowerCase()}`
				: "";

			const usd = (data.USD) ? `$${data.USD}` : "";
			const eur = (data.EUR) ? `€${data.EUR}` : "";

			return {
				reply: `Current price of ${symbol}: ${usd} ${eur} ${link}`
			};
		}
	}),
	Dynamic_Description: null
};
