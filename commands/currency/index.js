module.exports = {
	Name: "currency",
	Aliases: ["money"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Attempts to convert a specified amount of one currency to another. Only supports 3-letter ISO codes. Example: 100 USD to EUR.",
	Flags: ["mention","non-nullable","pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function currency (context, amount, first, separator, second) {
		if (!second && !separator) {
			second = first;
			first = amount;
			amount = "1";
		}
		if (!second) {
			second = separator;
			first = amount;
			amount = "1";
		}

		second ??= "USD";

		if (!first || !second) {
			return {
				success: false,
				reply: "Invalid syntax! Use (amount) (from-currency) to (to-currency) - e.g. 1 USD to EUR",
				cooldown: 2500
			};
		}
		else if (first === second) {
			const dankEmote = await context.getBestAvailableEmote(["FeelsDankMan"], "😕");
			return {
				reply: `${dankEmote} 👍 1 ${first} = 1 ${second}, who would have thought?`
			};
		}

		let multiplier = 1;
		if (/k/i.test(amount)) {
			multiplier = 1.0e3;
		}
		else if (/m/i.test(amount)) {
			multiplier = 1.0e6;
		}
		else if (/b/i.test(amount)) {
			multiplier = 1.0e9;
		}
		else if (/t/i.test(amount)) {
			multiplier = 1.0e12;
		}

		amount = amount.replace(/[kmbt]/gi, "").replace(/,/g, ".");
		if (!Number(amount)) {
			return {
				success: false,
				reply: "The amount of currency must be a proper finite number!",
				cooldown: {
					length: 2500
				}
			};
		}

		const symbolCheck = /^[A-Z]{3}$/;
		first = first.toUpperCase();
		second = second.toUpperCase();

		if (!symbolCheck.test(first) || !symbolCheck.test(second)) {
			return {
				success: false,
				reply: "Invalid symbol syntax - must use 3-letter codes!",
				cooldown: 2500
			};
		}

		let data = await this.getCacheData("currency-rates");
		if (!data) {
			const response = await sb.Got("GenericAPI", {
				method: "GET",
				url: "https://openexchangerates.org/api/latest.json",
				searchParams: {
					app_id: sb.Config.get("API_OPEN_EXCHANGE_RATES")
				}
			});

			data = response.body.rates;
			await this.setCacheData("currency-rates", data, {
				expiry: 3_600_000 // 1 hour
			});
		}

		if (!data[first] || !data[second]) {
			const unrecognized = [];
			if (!data[first]) {
				unrecognized.push(first);
			}
			if (!data[second]) {
				unrecognized.push(first);
			}

			return {
				success: false,
				reply: `One or more currency codes were not recognized! ${unrecognized.join(", ")}`
			};
		}

		let ratio;
		if (first === "USD" || second === "USD") {
			ratio = (first === "USD")
				? data[second]
				: 1 / data[first];
		}
		else {
			ratio = (data[second] / data[first]);
		}

		const firstAmount = sb.Utils.groupDigits(amount * multiplier);
		const secondAmount = sb.Utils.groupDigits(sb.Utils.round(amount * multiplier * ratio, 2));

		let message = `${firstAmount} ${first} = ${secondAmount} ${second}`;

		// Special case for Iranian Rial - official exchange rates are frozen (as of 2021) and not relevant
		if (first === "IRR" || second === "IRR") {
			let dollarExchangeRate = await this.getCacheData("irr-usd-exchange-rate");
			if (!dollarExchangeRate) {
				const response = await sb.Got("GenericAPI", {
					url: "https://call4.tgju.org/ajax.json",
					throwHttpErrors: false
				});

				if (response.statusCode === 200) {
					const data = response.body.current?.price_dollar_rl;
					dollarExchangeRate = Number(data.p.replaceAll(",", ""));

					if (!Number.isNaN(dollarExchangeRate)) {
						await this.setCacheData("irr-usd-exchange-rate", dollarExchangeRate, {
							expiry: 3_600_000 // 1 hour
						});
					}
				}
			}

			if (dollarExchangeRate) {
				const otherCurrency = (first === "IRR") ? second : first;
				let ratio;
				if (first === "USD" || second === "USD") {
					ratio = (second === "USD") ? (1 / dollarExchangeRate) : dollarExchangeRate;
				}
				else {
					const convertKey = `USD_${otherCurrency}`;
					const response = await sb.Got("GenericAPI", {
						url: "https://free.currconv.com/api/v7/convert",
						searchParams: {
							apiKey: sb.Config.get("API_FREE_CURRENCY_CONVERTER"),
							q: convertKey,
							compact: "y"
						}
					});

					const otherCurrencyRatio = response.body[convertKey].val;
					ratio = (first === "IRR")
						? (otherCurrencyRatio / dollarExchangeRate)
						: (dollarExchangeRate / otherCurrencyRatio);
				}

				const roundLimit = (first === "IRR") ? 2 : 0;
				const fixedSecondAmount = sb.Utils.groupDigits(sb.Utils.round(amount * multiplier * ratio, roundLimit));
				message = `Official: ${message}; True: ${firstAmount} ${first} = ${fixedSecondAmount} ${second}`;
			}
		}

		return {
			reply: message
		};
	}),
	Dynamic_Description: (async (prefix) => [
		`Converts an amount of currency (or 1, if not specified) to another currency`,
		``,

		`<code>${prefix}currency 100 EUR to USD</code>`,
		`100 EUR = (amount) USD`,
		``,

		`<code>${prefix}currency EUR to VND</code>`,
		`1 EUR = (amount) VND`
	])
};
