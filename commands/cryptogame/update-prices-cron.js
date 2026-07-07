import { SupiDate, SupiError } from "supi-core";
const IGNORED_ASSETS = new Set(["VEF"]);

export default async (cron) => {
	// fix the return later
	if (!process.env.API_CRYPTO_COMPARE) {
		return;
	}
	if (!process.env.API_FIXER_IO) {
		return;
	}

	const conditionalFixerIo = (async () => {
		if (new SupiDate().hours % 12 !== 0) {
			return { rates: {} };
		}

		return core.Got.get("GenericAPI")({
			prefixUrl: "https://data.fixer.io/api",
			url: "latest",
			throwHttpErrors: false,
			responseType: "json",
			searchParams: {
				access_key: process.env.API_FIXER_IO
			}
		}).json();
	});

	const [rawCryptoData, currencyData, goldData, silverData] = await Promise.allSettled([
		core.Got.get("GenericAPI")({
			url: "https://api.coingecko.com/api/v3/simple/price",
			searchParams: {
				vs_currencies: "EUR",
				symbols: "BTC,XRP,DOGE,ETH,BCH,LTC,EOS,XLM,BNB,USDT,DOT,ADA,LINK,XMR,SHIB"
			},
			headers: {
				"x-cg-demo-api-key": process.env.API_CRYPTO_GECKO
			}
		}),

		conditionalFixerIo(),

		core.Got.get("GenericAPI")({
			url: "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/EUR"
		}).json(),

		core.Got.get("GenericAPI")({
			url: "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAG/EUR"
		}).json()
	]);

	const cryptoData = {};
	for (const [key, value] of Object.entries(rawCryptoData.value.body)) {
		cryptoData[key.toUpperCase()] = value.eur;
	}

	const totalData = {
		...cryptoData?.value,
		...currencyData?.value?.rates
	};

	if (goldData.status === "fulfilled") {
		totalData.XAU = goldData.value[0].spreadProfilePrices[0].bid;
	}
	if (silverData.status === "fulfilled") {
		totalData.XAG = silverData.value[0].spreadProfilePrices[0].bid;
	}

	const now = new SupiDate();
	const uppercaseOnly = /^[A-Z]+$/;
	const promises = Object.entries(totalData).map(async ([code, value]) => {
		if (!uppercaseOnly.test(code)) {
			return;
		}
		else if (IGNORED_ASSETS.has(code)) {
			return;
		}

		const row = await core.Query.getRow("crypto_game", "Asset");
		await row.load(code, true);
		if (!row.loaded) {
			row.values.Code = code;
		}

		const adjustedValue = (code === "XAU" || code === "XAG")
			? value
			: (1 / value);

		row.values.Price = core.Utils.round(adjustedValue, 9, { direction: "round" });
		row.values.Last_Update = now;
		await row.save({ skipLoad: true });
	});

	await Promise.all(promises);
};
