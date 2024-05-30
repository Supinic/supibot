module.exports = {
	Name: "stock",
	Aliases: ["stocks", "stonks"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the latest price and daily change for a stock.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function stock (context, ...args) {
		const { findPopularSymbol } = require("./stocks.js");
		const input = args.join(" ");
		if (!input) {
			return {
				success: false,
				reply: "A stock symbol must be provided!"
			};
		}

		// If the input is a single argument consisting of capital characters only, we can (somewhat) safely assume
		// that it's a stock symbol and not a name. We can then try looking up a popular stock name instead of its code.
		const symbol = (args.length === 1 && /^[A-Z]+$/.test(args[0]))
			? args[0]
			: findPopularSymbol(input) ?? args[0];

		const response = await sb.Got("GenericAPI", {
			retry: {
				limit: 0
			},
			throwHttpErrors: false,
			url: "https://www.alphavantage.co/query",
			searchParams: {
				function: "GLOBAL_QUOTE",
				symbol,
				apikey: sb.Config.get("API_ALPHA_AVANTAGE")
			}
		});

		const rawData = response.body["Global Quote"];
		if (!rawData || Object.keys(rawData).length === 0) {
			return {
				success: false,
				reply: "Stock symbol could not be found!"
			};
		}

		// Fix the API's crazy key naming syntax (e.g. data["01. symbol"])
		const data = {};
		for (const rawKey of Object.keys(rawData)) {
			const fixedKey = rawKey.replace(/^\d+\.\s+/, "");
			const key = sb.Utils.convertCase(fixedKey, "text", "camel");
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
