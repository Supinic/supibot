const cryptoGamePriceUpdate = async () => {
	const ignoredAssets = ["VEF"];

	const conditionalFixerIo = (async () => {
		if (new sb.Date().hours % 12 !== 0) {
			return { rates: {} };
		}

		return sb.Got("GenericAPI", {
			prefixUrl: "https://data.fixer.io/api",
			url: "latest",
			throwHttpErrors: false,
			responseType: "json",
			searchParams: {
				access_key: sb.Config.get("API_FIXER_IO")
			}
		}).json();
	});

	const [cryptoData, currencyData, goldData, silverData] = await Promise.allSettled([
		sb.Got("GenericAPI", {
			url: "https://min-api.cryptocompare.com/data/price",
			searchParams: {
				fsym: "EUR",
				tsyms: "BTC,XRP,DOGE,ETH,BCH,LTC,EOS,XLM,BNB,USDT,DOT,ADA,LINK,XMR,ANAL,SHIB"
			},
			headers: {
				Authorization: `Apikey ${sb.Config.get("API_CRYPTO_COMPARE")}`
			}
		}).json(),

		conditionalFixerIo(),

		sb.Got("GenericAPI", {
			url: "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/EUR"
		}).json(),

		sb.Got("GenericAPI", {
			url: "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAG/EUR"
		}).json()
	]);

	const totalData = {
		...(cryptoData?.value ?? {}),
		...(currencyData?.value?.rates ?? {})
	};

	if (goldData.status === "fulfilled") {
		totalData.XAU = goldData.value[0].spreadProfilePrices[0].bid;
	}
	if (silverData.status === "fulfilled") {
		totalData.XAG = silverData.value[0].spreadProfilePrices[0].bid;
	}

	const now = new sb.Date();
	const uppercaseOnly = /^[A-Z]+$/;
	const promises = Object.entries(totalData).map(async ([code, value]) => {
		if (!uppercaseOnly.test(code)) {
			return;
		}
		else if (ignoredAssets.includes(code)) {
			return;
		}

		const row = await sb.Query.getRow("crypto_game", "Asset");
		await row.load(code, true);
		if (!row.values.Code) {
			row.values.Code = code;
		}

		const adjustedValue = (code === "XAU" || code === "XAG")
			? value
			: (1 / value);

		row.values.Price = sb.Utils.round(adjustedValue, 9, { direction: "round" });
		row.values.Last_Update = now;
		await row.save({ skipLoad: true });
	});

	await Promise.all(promises);
};

module.exports = {
	cryptoGamePriceUpdate
};
