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
		else {
			return {
				reply: `Current price of ${symbol}: $${data.USD}, €${data.EUR}`
			};
		}
	}),
	Dynamic_Description: null
};