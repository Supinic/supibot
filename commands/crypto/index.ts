import * as z from "zod";
import { SupiError } from "supi-core";
import { declare } from "../../classes/command.js";

const cryptoSchema = z.union([
	z.object({ Response: z.literal("Error"), Message: z.string() }),
	z.object({
		USD: z.number().optional(),
		EUR: z.number().optional()
	})
]);

export default declare({
	Name: "crypto",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the latest price of a cryptocurrency. If none is provided, defaults to BTC.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function crypto (context, symbol = "BTC") {
		if (!process.env.API_CRYPTO_COMPARE) {
			throw new SupiError({
				message: "No CryptoCompare key configured (API_CRYPTO_COMPARE)"
			});
		}

		symbol = symbol.toUpperCase();

		const response = await core.Got.get("GenericAPI")({
			url: "https://min-api.cryptocompare.com/data/price",
			searchParams: {
				fsym: symbol,
				tsyms: "USD,EUR"
			},
			timeout: {
				request: 10000
			},
			headers: {
				Authorization: `Apikey ${process.env.API_CRYPTO_COMPARE}`
			}
		});

		const data = cryptoSchema.parse(response.body);
		if ("Response" in data) {
			return {
				success: false,
				reply: `Could not fetch price data! Error: ${data.Message}`
			};
		}
		else if (!data.USD && !data.EUR) {
			return {
				success: false,
				reply: `No known prices found for that currency!`
			};
		}

		let url;
		if (!context.channel || context.channel.Links_Allowed) {
			try {
				const response = await core.Got.get("Global")({
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
			catch {
				url = null;
			}
		}

		const link = (url)
			? `Check recent history for ${symbol} here: ${url}`
			: "";

		const usd = (data.USD) ? `$${data.USD}` : "";
		const eur = (data.EUR) ? `€${data.EUR}` : "";
		return {
			success: true,
			reply: `Current price of ${symbol}: ${usd} ${eur} ${link}`,
			removeEmbeds: true
		};
	}),
	Dynamic_Description: null
});
