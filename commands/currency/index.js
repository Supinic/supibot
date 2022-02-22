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
		if (!first || !second) {
			return {
				success: false,
				reply: "Invalid syntax! Use (amount) (from-currency) to (to-currency) - e.g. 1 USD to EUR",
				cooldown: 2500
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

		const convertKey = `${first}_${second}`;
		const response = await sb.Got("GenericAPI", {
			url: "https://free.currconv.com/api/v7/convert",
			searchParams: {
				apiKey: sb.Config.get("API_FREE_CURRENCY_CONVERTER"),
				q: convertKey,
				compact: "y"
			}
		});

		if (!response.body[convertKey]) {
			return {
				success: false,
				reply: "One or both currency codes were not recognized!"
			};
		}

		const ratio = response.body[convertKey].val;
		const firstAmount = sb.Utils.groupDigits(amount * multiplier);
		const secondAmount = sb.Utils.groupDigits(sb.Utils.round(amount * multiplier * ratio, 3));

		let message = `${firstAmount} ${first} = ${secondAmount} ${second}`;

		// Special case for Iranian Rial - official exchange rates are frozen (as of 2021) and not relevant
		if (first === "IRR" || second === "IRR") {
			let dollarExchangeRate = await this.getCacheData("irr-usd-exchange-rate");
			if (!dollarExchangeRate) {
				const response = await sb.Got("GenericAPI", {
					url: "https://dapi.p3p.repl.co/api/",
					searchParams: {
						currency: "usd"
					}
				});

				if (response.statusCode === 200) {
					dollarExchangeRate = Number(response.body.Price);
					await this.setCacheData("irr-usd-exchange-rate", dollarExchangeRate);
				}
			}

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

			const fixedSecondAmount = sb.Utils.groupDigits(sb.Utils.round(amount * multiplier * ratio, 3));
			message = `Official: ${message}; True: ${firstAmount} ${first} = ${fixedSecondAmount} ${second}`;
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
