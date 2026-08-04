import * as z from "zod";
import { SupiError } from "supi-core";
import { declare } from "../../classes/command.js";

// nonexistent symbol = empty object as response
// otherwise, the record keys will be the requested symbols
const cryptoSchema = z.record(
	z.string(),
	z.object({
		usd: z.number().optional(),
		eur: z.number().optional()
	})
);

const commonSymbolsMap = new Map<string, string>([
	["BTC", "bitcoin"],
	["ETH", "ethereum"]
]);

export default declare({
	Name: "crypto",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the latest price of a cryptocurrency. If none is provided, defaults to BTC.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function crypto (context, input = "bitcoin") {
		if (!process.env.API_CRYPTO_GECKO) {
			throw new SupiError({
				message: "No CryptoCompare key configured (API_CRYPTO_GECKO)"
			});
		}

		input = input.toUpperCase();
		const name = commonSymbolsMap.get(input) ?? input;

		const response = await core.Got.get("GenericAPI")({
			url: "https://api.coingecko.com/api/v3/simple/price",
			searchParams: {
				ids: name,
				symbols: name,
				names: name,
				vs_currencies: "USD,EUR"
			},
			headers: {
				"x-cg-demo-api-key": process.env.API_CRYPTO_GECKO
			}
		});

		const apiData = cryptoSchema.parse(response.body);
		const symbolKey = Object.keys(apiData).at(0);
		if (!symbolKey) {
			return {
				success: false,
				reply: `Your provided symbol was not found on the CryptoGecko API!`
			};
		}

		const data = apiData[symbolKey];
		if (!data.usd && !data.eur) {
			return {
				success: false,
				reply: `No known prices found for that cryptocurrency!`
			};
		}

		let url;
		if (!context.channel || context.channel.Links_Allowed) {
			try {
				const response = await core.Got.get("Global")({
					method: "HEAD",
					url: `https://www.coindesk.com/price/${input.toLowerCase()}`,
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

				const coin = response.url.split("/").at(-1);
				if (coin) {
					url = `https://www.coingecko.com/en/coins/${coin}`;
				}
				else {
					url = response.url;
				}
			}
			catch {
				url = null;
			}
		}

		const link = (url)
			? `Check recent history for ${input} here: ${url}`
			: "";

		const usd = (data.usd) ? `$${data.usd}` : "";
		const eur = (data.eur) ? `€${data.eur}` : "";
		return {
			success: true,
			reply: `Current price of ${input}: ${usd} ${eur} ${link}`,
			removeEmbeds: true
		};
	}),
	Dynamic_Description: null
});
