module.exports = {
	Name: "stock",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the latest price and daily change for a stock.",
	Flags: ["mention","non-nullable","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function stock (context, stockSymbol) {
		if (!stockSymbol) {
			return { reply: "A stock symbol must be provided!" };
		}
	
		const { "Global Quote": rawData } = await sb.Got({
			retry: 0,
			throwHttpErrors: false,
			url: "https://www.alphavantage.co/query",
			searchParams: new sb.URLParams()
				.set("function", "GLOBAL_QUOTE")
				.set("symbol", stockSymbol)
				.set("apikey", sb.Config.get("API_ALPHA_AVANTAGE"))
				.toString()
		}).json();
	
		if (!rawData || Object.keys(rawData).length === 0) {
			return {
				reply: "Stock symbol could not be found!"
			};
		}
	
		const data = {};
		for (const rawKey of Object.keys(rawData)) {
			const key = sb.Utils.convertCase(rawKey.replace(/^\d+\.\s+/, ""), "text", "camel");
			data[key] = rawData[rawKey];
		}
	
		const changeSymbol = (Number(data.changePercent.replace("%", "")) >= 0) ? "+" : "";
		return {
			reply: sb.Utils.tag.trim `
				${data.symbol}: Current price: $${data.price}, change: ${changeSymbol}${data.changePercent}.
				Close price: $${data.previousClose}.
				Open price: $${data.open}.
			`
		};
	}),
	Dynamic_Description: null
};