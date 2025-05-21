export const baseAsset = {
	Code: "EUR",
	Price: 1
};

export const availableCommands = [
	"assets",
	"average",
	"buy",
	"check",
	"leaderboard",
	"register",
	"portfolios",
	"prices",
	"rank",
	"sell",
	"total"
];

export const precisionRound = (num, precision, direction) => (
	Number(core.Utils.round(num, precision, { direction }).toPrecision(precision + 1))
);

export const getAssetData = async (code) => {
	const data = await core.Query.getRecordset(rs => rs
		.select("Code", "Price")
		.from("crypto_game", "Asset")
		.where("Code = %s", code.toUpperCase())
		.single()
		.limit(1)
	);

	return data ?? null;
};

export const getPortfolioData = async (identifier) => {
	const portfolioID = await core.Query.getRecordset(rs => {
		rs.select("ID")
			.from("crypto_game", "Portfolio")
			.where("Active = %b", true)
			.limit(1)
			.single()
			.flat("ID");

		if (typeof identifier === "number") {
			rs.where("Owner = %n", identifier);
		}
		else if (typeof identifier === "string") {
			rs.where("ID = %s", identifier);
		}
		else {
			throw new sb.Error({
				message: "Invalid portfolio identifier provided",
				args: { identifier }
			});
		}

		return rs;
	});

	if (!portfolioID) {
		return null;
	}

	const data = await core.Query.getRecordset(rs => rs
		.select("Asset AS Code", "Amount")
		.from("crypto_game", "Portfolio_Asset")
		.where("Portfolio = %s", portfolioID)
	);

	return {
		ID: portfolioID,
		assets: data.map(i => ({
			Code: i.Code,
			Amount: core.Utils.round(i.Amount, 6, { direction: "floor" })
		}))
	};
};

export const parseArguments = async (input) => {
	const result = {};
	for (const [key, value] of Object.entries(input)) {
		if (key === "user") {
			if (!value) {
				return {
					success: false,
					reply: "No user provided!"
				};
			}

			const userData = await sb.User.get(value);
			if (!userData) {
				return {
					success: false,
					reply: "Invalid user provided!"
				};
			}

			result.user = userData;
		}
		else if (key === "asset") {
			if (!value) {
				return {
					success: false,
					reply: "No asset provided!"
				};
			}

			const assetData = await getAssetData(value);
			if (!assetData) {
				return {
					success: false,
					reply: "Invalid asset provided! Check list: https://supinic.com/crypto-game/asset/list"
				};
			}

			result.asset = assetData;
		}
		else if (key === "amount") {
			if (!value) {
				return {
					success: false,
					reply: "No amount provided!"
				};
			}
			else if (value === "all") {
				result.amount = "all";
			}
			else if (value.endsWith("%")) {
				result.amount = value.trim();
			}
			else {
				const amount = Number(value);
				if (!Number.isFinite(amount) || amount <= 0) {
					return {
						success: false,
						reply: `Invalid amount provided!`
					};
				}

				result.amount = amount;
			}
		}
	}

	return result;
};

export const checkPortfolioAsset = (portfolioData, assetData, amount) => {
	const asset = portfolioData.assets.find(i => i.Code === assetData.Code);
	if (!asset) {
		return `You don't have any ${assetData.Code}!`;
	}
	else if (asset.Amount < amount) {
		return `You don't have enough ${assetData.Code}! You have ${asset.Amount}, and need ${amount}.`;
	}
	else {
		return true;
	}
};

export const updatePortfolioAsset = async (portfolioData, assetData, amount) => {
	if (typeof portfolioData === "string") {
		portfolioData = await getPortfolioData(portfolioData);
	}

	const targetAsset = portfolioData.assets.find(i => i.Code === assetData.Code);
	if (!targetAsset) {
		if (amount <= 0) {
			throw new sb.Error({
				message: "Invalid operation - no asset, negative amount"
			});
		}

		const row = await core.Query.getRow("crypto_game", "Portfolio_Asset");
		row.setValues({
			Portfolio: portfolioData.ID,
			Asset: assetData.Code,
			Amount: amount
		});
		await row.save({ skipLoad: true });
	}
	else {
		if ((targetAsset.Amount + amount) < 0) {
			throw new sb.Error({
				message: "Invalid operation - asset exists, negative net amount"
			});
		}

		await core.Query.getRecordUpdater(ru => ru
			.update("crypto_game", "Portfolio_Asset")
			.set("Amount", {
				useField: true,
				value: `Amount + ${amount}`
			})
			.where("Portfolio = %s", portfolioData.ID)
			.where("Asset = %s", assetData.Code)
		);
	}
};

export const createTransferTransaction = async (sourcePortfolio, targetPortfolio, assetData, amount) => {
	const row = await core.Query.getRow("crypto_game", "Transaction");
	row.setValues({
		Source_Portfolio: sourcePortfolio.ID,
		Source_Asset: assetData.Code,
		Source_Amount: amount,
		Exchange_Rate: null,
		Target_Portfolio: targetPortfolio.ID,
		Target_Asset: assetData.Code,
		Target_Amount: amount
	});

	await Promise.all([
		row.save({ skipLoad: true }),
		updatePortfolioAsset(sourcePortfolio, assetData, -amount),
		updatePortfolioAsset(targetPortfolio, assetData, amount)
	]);
};

export const createConvertTransaction = async (portfolioData, sourceAsset, targetAsset, rawSourceAmount) => {
	// const sourceAmount = precisionRound(rawSourceAmount, 9, "round");
	const exchangeRate = targetAsset.Price / sourceAsset.Price;
	const targetAmount = precisionRound(rawSourceAmount / exchangeRate, 6, "round");
	let sourceAmount = precisionRound(targetAmount * exchangeRate, 6, "round");

	const checkAmount = portfolioData.assets.find(i => i.Code === sourceAsset.Code)?.Amount ?? 0;
	if (sourceAmount > checkAmount) {
		sourceAmount = checkAmount;
	}

	const row = await core.Query.getRow("crypto_game", "Transaction");
	row.setValues({
		Source_Portfolio: portfolioData.ID,
		Source_Asset: sourceAsset.Code,
		Source_Amount: sourceAmount,
		Exchange_Rate: exchangeRate,
		Target_Portfolio: portfolioData.ID,
		Target_Asset: targetAsset.Code,
		Target_Amount: targetAmount
	});

	await Promise.all([
		row.save({ skipLoad: true }),
		updatePortfolioAsset(portfolioData, sourceAsset, -sourceAmount),
		updatePortfolioAsset(portfolioData, targetAsset, targetAmount)
	]);

	return {
		exchangeRate,
		sourceAmount,
		targetAmount
	};
};
