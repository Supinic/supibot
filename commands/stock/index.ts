import * as z from "zod";
import { SupiError } from "supi-core";
import { declare } from "../../classes/command.js";
import rawSymbolData from "./popular-stock-symbols.json" with { type: "json" };

const symbolSchema = z.array(z.tuple([z.string(), z.string()]));
const symbolData = symbolSchema.parse(rawSymbolData);

const stockSchema = z.object({
	"Global Quote": z.union([
		z.object({
			"01. symbol": z.string(),
			"02. open": z.string(),
			"05. price": z.string(),
			"08. previous close": z.string(),
			"10. change percent": z.string()
		}),
		z.object({}) // API returns an empty object when no stock symbol matches (response code 200, of course)
	])
}).transform(({ "Global Quote": g }) => {
	if (Object.keys(g).length === 0) {
		return null;
	}

	return {
		symbol: g["01. symbol"],
		open: Number(g["02. open"]),
		price: Number(g["05. price"]),
		previousClose: Number(g["08. previous close"]),
		changePercent: g["10. change percent"]
	};
});

const findPopularSymbol = (from: string) => {
	from = from.toLowerCase();

	let bestScore = -Infinity;
	let index = -1;
	for (let i = 0; i < symbolData.length; i++) {
		const currentName = symbolData[i][1];
		if (!currentName.includes(from)) {
			continue;
		}

		const score = core.Utils.jaroWinklerSimilarity(from, currentName);
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
};

export default declare({
	Name: "stock",
	Aliases: ["stocks", "stonks"],
	Cooldown: 10000,
	Description: "Fetches the latest price and daily change for a stock.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: async function stock (context, ...args) {
		if (!process.env.API_ALPHA_VANTAGE) {
			throw new SupiError({
				message: "No AlphaVantage key configured (API_ALPHA_VANTAGE)"
			});
		}

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

		const response = await core.Got.get("GenericAPI")({
			retry: {
				limit: 0
			},
			throwHttpErrors: false,
			url: "https://www.alphavantage.co/query",
			searchParams: {
				function: "GLOBAL_QUOTE",
				symbol,
				apikey: process.env.API_ALPHA_VANTAGE
			}
		});

		const data = stockSchema.parse(response.body);
		if (!data) {
			return {
				success: false,
				reply: "Stock symbol could not be found!"
			};
		}

		const changeSymbol = (Number(data.changePercent.replace("%", "")) >= 0) ? "+" : "";
		return {
			reply: core.Utils.tag.trim `
				${data.symbol}: Current price: $${data.price}, change: ${changeSymbol}${data.changePercent}.
				Close price: $${data.previousClose}.
				Open price: $${data.open}.
			`
		};
	},
	Dynamic_Description: null
});
