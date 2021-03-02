module.exports = {
	Name: "stock",
	Aliases: ["stocks", "stonks"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the latest price and daily change for a stock.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => {
		const symbolData = sb.Config.get("STOCK_SYMBOLS_LIST");
		const findSymbol = (from) => {
			from = from.toLowerCase();

			let bestScore = -Infinity;
			let index = -1;
			for (let i = 0; i < symbolData.length; i++) {
				const currentName = symbolData[i][1];
				if (!currentName.include(from)) {
					continue;
				}

				const score = sb.Utils.jaroWinklerSimilarity(from, currentName);
				if (score > 0 && score > bestScore) {
					bestScore = score;
					index = i;
				}
			}

			if (bestScore === -Infinity) {
				return null;
			}
			else {
				return symbolData[index][0];
			}
		}

		return {
			findSymbol
		};
	}),
	Code: (async function stock (context, ...args) {
		const input = args.join(" ");
		if (!input) {
			return {
				success: false,
				reply: "A stock symbol must be provided!"
			};
		}

		const { findSymbol } = this.staticData;
		const symbol = findSymbol(input) ?? args[0];

		const { "Global Quote": rawData } = await sb.Got({
			retry: 0,
			throwHttpErrors: false,
			url: "https://www.alphavantage.co/query",
			searchParams: new sb.URLParams()
				.set("function", "GLOBAL_QUOTE")
				.set("symbol", symbol)
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