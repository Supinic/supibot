module.exports = {
	Name: "cryptowallet",
	Aliases: ["cw"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Checks for the balance of a crypto wallet. Currently supports BTC and ETH.",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: [
		{ name: "type", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function cryptoWallet (context, address) {
		if (!address) {
			return {
				success: false,
				reply: `No wallet address provided!`
			};
		}

		let symbol;
		let value;
		const type = (context.params.type ?? "btc").toLowerCase();

		if (type === "btc" || type === "bitcoin") {
			const response = await sb.Got("GenericAPI", {
				url: `https://blockchain.info/rawaddr/${address}`,
				throwHttpErrors: false,
				searchParams: {
					limit: "0"
				}
			});

			if (response.statusCode === 404) {
				return {
					success: false,
					reply: `Provided BTC address does not exist!`
				};
			}

			const satoshi = Number(response.body.final_balance);
			value = satoshi / 1e8;
			symbol = "BTC";
		}
		else if (type === "eth" || type === "ether" || type === "ethereum") {
			const response = await sb.Got("GenericAPI", {
				url: "https://api.etherscan.io/api",
				searchParams: {
					module: "account",
					action: "balance",
					tag: "latest",
					address
				}
			});

			if (response.body.status === "0") {
				return {
					success: false,
					reply: `Provided ETH address does not exist!`
				};
			}

			const wei = Number(response.body.result);
			value = wei / 1e18;
			symbol = "ETH";
		}

		const exchange = await sb.Got("GenericAPI", {
			url: "https://min-api.cryptocompare.com/data/price",
			searchParams: {
				fsym: symbol,
				tsyms: "USD,EUR"
			},
			timeout: 10000,
			headers: {
				Authorization: `Apikey ${sb.Config.get("API_CRYPTO_COMPARE")}`
			}
		});

		const crypto = sb.Utils.groupDigits(value);
		const usd = sb.Utils.groupDigits(sb.Utils.round(value * exchange.body.USD, 3));
		const eur = sb.Utils.groupDigits(sb.Utils.round(value * exchange.body.EUR, 3));

		return {
			reply: `The current balance of this address (${address.slice(0, 8)}) is ${crypto} ${symbol} - or $${usd} / €${eur}.`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Fetches a crypto wallet's current balance.",
		"",

		`<code>${prefix}cryptowallet (address)</code>`,
		`<code>${prefix}cryptowallet type:eth (address)</code>`,
		`<code>${prefix}cryptowallet type:btc (address)</code>`,
		`<code>${prefix}cryptowallet type:bitcoin (address)</code>`,
		"Fetches the balance in the given cryptocurrency, USD and EUR.",
		"Default type is <code>BTC</code>, use the <code>type</code> parameter to change that."
	])
};
