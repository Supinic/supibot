module.exports = {
	Name: "crypto",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the latest price of a cryptocurrency.",
	Flags: ["mention","non-nullable","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function crypto (context, symbol = "BTC") {
		symbol = symbol.toUpperCase();
	
		const data = await sb.Got({
			url: "https://min-api.cryptocompare.com/data/price",
			searchParams: new sb.URLParams().set("fsym", symbol).set("tsyms", "USD,EUR").toString(),
			headers: {
				Authorization: "Apikey " + sb.Config.get("API_CRYPTO_COMPARE")
			}
		}).json();
	
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
			const usd = (data.USD) ? `$${data.USD}` : "";
			const eur = (data.EUR) ? `€${data.EUR}` : "";

			return {
				reply: `Current price of ${symbol}: ${usd} €${eur}`
			};
		}
	}),
	Dynamic_Description: null
};