module.exports = {
	Name: "currency",
	Aliases: ["money"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Attempts to convert a specified amount of one currency to another. Only supports 3-letter ISO codes. Example: 100 USD to EUR.",
	Flags: ["mention","non-nullable","pipe","skip-banphrase"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function currency (context, amount, first, separator, second)  {
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
	
		if (!this.data.cache || this.data.cache.expiry > sb.Date.now()) {
			const { statusCode, body: data } = await sb.Got({
				prefixUrl: "http://data.fixer.io/api",
				url: "latest",
				throwHttpErrors: false,
				responseType: "json",
				searchParams: new sb.URLParams()
					.set("access_key", sb.Config.get("API_FIXER_IO"))
					.toString()
			});
	
			if (statusCode !== 200) {
				throw new sb.errors.APIError({
					statusCode,
					apiName: "ForexAPI"
				});
			}
	
			this.data.cache = {
				rates: data.rates,
				expiry: new sb.Date().addHours(1).valueOf()
			}
		}
	
		const { rates } = this.data.cache;
		if (!rates[first] || !rates[second]) {
			return {
				success: false,
				reply: "Unrecognized currency code(s)! " + [first, second].filter(i => !rates[i]).join(", ")
			};
		}
	
		const ratio = rates[second] / rates[first];
		if (typeof ratio === "number") {
			return {
				reply: `${amount * multiplier} ${first} = ${sb.Utils.round(amount * multiplier * ratio, 3)} ${second}`
			};
		}
		else {
			return {
				reply: "One or both currencies were not recognized!"
			};
		}
	}),
	Dynamic_Description: (async (prefix) =>  [
		`Converts an amount of currency (or 1, if not specified) to another currency`,
		``,
	
		`<code>${prefix}currency 100 EUR to USD</code>`,
		`100 EUR = (amount) USD`,
		``,
	
		`<code>${prefix}currency EUR to VND</code>`,
		`1 EUR = (amount) VND`
	])
};