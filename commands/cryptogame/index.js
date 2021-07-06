module.exports = {
	Name: "cryptogame",
	Aliases: ["cg"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Crypto game command! Receive the equivalent of €1000 on your \"portfolio\" and invest them into various currencies and assets to see how well you can increase your worth. Who shall become the best investor Supibot-land has ever known?",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => {
		this.data.updateCron = new sb.Cron({
			Name: "crypto-game-price-updater",
			Description: "Regularly updates the prices used in the crypto-game command.",
			Expression: "0 0 * * * *",
			Code: (async function cryptoGamePriceUpdate () {
				const ignoredAssets = ["VEF"];
				const totalData = {};

				const conditionalFixerIo = (async () => {
					if (new sb.Date().hours % 12 !== 0) {
						return { rates: {} };
					}

					return sb.Got({
						prefixUrl: "http://data.fixer.io/api",
						url: "latest",
						throwHttpErrors: false,
						responseType: "json",
						searchParams: new sb.URLParams()
							.set("access_key", sb.Config.get("API_FIXER_IO"))
							.toString()
					}).json();
				});

				const [cryptoData, currencyData, goldData, silverData] = await Promise.all([
					sb.Got({
						url: "https://min-api.cryptocompare.com/data/price",
						searchParams: new sb.URLParams()
							.set("fsym", "EUR")
							.set("tsyms", "BTC,XRP,DOGE,ETH,BCH,LTC,EOS,XLM,BNB,USDT,DOT,ADA,LINK,XMR,ANAL")
							.toString(),
						headers: {
							Authorization: `Apikey ${sb.Config.get("API_CRYPTO_COMPARE")}`
						}
					}).json(),

					conditionalFixerIo(),

					sb.Got({
						url: "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/EUR"
					}).json(),

					sb.Got({
						url: "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAG/EUR"
					}).json()
				]);

				Object.assign(totalData, cryptoData, currencyData.rates);
				totalData.XAU = goldData[0].spreadProfilePrices[0].bid;
				totalData.XAG = silverData[0].spreadProfilePrices[0].bid;

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
			})
		});
		this.data.updateCron.start();

		const baseAsset = {
			Code: "EUR",
			Price: 1
		};

		const precisionRound = (num, precision, direction) => (
			Number(sb.Utils.round(num, precision, { direction }).toPrecision(precision + 1))
		);

		const getAssetData = async (code) => {
			const data = await sb.Query.getRecordset(rs => rs
				.select("Code", "Price")
				.from("crypto_game", "Asset")
				.where("Code = %s", code.toUpperCase())
				.single()
				.limit(1)
			);

			return data ?? null;
		};

		const getPortfolioData = async (identifier) => {
			const portfolioID = await sb.Query.getRecordset(rs => {
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

			const data = await sb.Query.getRecordset(rs => rs
				.select("Asset AS Code", "Amount")
				.from("crypto_game", "Portfolio_Asset")
				.where("Portfolio = %s", portfolioID)
			);

			return {
				ID: portfolioID,
				assets: data.map(i => ({
					Code: i.Code,
					Amount: sb.Utils.round(i.Amount, 6, { direction: "floor" })
				}))
			};
		};

		const parseArguments = async (input) => {
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

		const checkPortfolioAsset = (portfolioData, assetData, amount) => {
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

		const updatePortfolioAsset = async (portfolioData, assetData, amount) => {
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

				const row = await sb.Query.getRow("crypto_game", "Portfolio_Asset");
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

				await sb.Query.getRecordUpdater(ru => ru
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

		const createTransferTransaction = async (sourcePortfolio, targetPortfolio, assetData, amount) => {
			const row = await sb.Query.getRow("crypto_game", "Transaction");
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

		const createConvertTransaction = async (portfolioData, sourceAsset, targetAsset, rawSourceAmount) => {
			// const sourceAmount = precisionRound(rawSourceAmount, 9, "round");
			const exchangeRate = targetAsset.Price / sourceAsset.Price;
			const targetAmount = precisionRound(rawSourceAmount / exchangeRate, 6, "round");
			let sourceAmount = precisionRound(targetAmount * exchangeRate, 6, "round");

			const checkAmount = portfolioData.assets.find(i => i.Code === sourceAsset.Code)?.Amount ?? 0;
			if (sourceAmount > checkAmount) {
				sourceAmount = checkAmount;
			}

			const row = await sb.Query.getRow("crypto_game", "Transaction");
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

		const destroy = (command) => {
			if (command.data.updateCron) {
				command.data.updateCron.destroy();
			}
		};

		return {
			availableCommands: ["assets", "average", "buy", "check", "leaderboard", "register", "portfolios", "prices", "rank", "sell", "total"],
			destroy,

			baseAsset,
			getPortfolioData,
			parseArguments,
			checkPortfolioAsset,
			updatePortfolioAsset,
			createConvertTransaction,
			createTransferTransaction
		};
	}),
	Code: (async function cryptoGame (context, command, ...args) {
		const {
			availableCommands,
			baseAsset,
			checkPortfolioAsset,
			createConvertTransaction,
			getPortfolioData,
			parseArguments,
			updatePortfolioAsset
		} = this.staticData;

		command = command?.toLowerCase();
		if (!command || !availableCommands.includes(command)) {
			return {
				success: false,
				reply: `No subcommand provided! Use one of: ${availableCommands.join(", ")}`
			};
		}

		const portfolioData = await getPortfolioData(context.user.ID);
		switch (command) {
			case "register": {
				if (portfolioData) {
					return {
						success: false,
						reply: "You already registered for a portfolio!"
					};
				}

				const portfolioRow = await sb.Query.getRow("crypto_game", "Portfolio");
				portfolioRow.values.Owner = context.user.ID;

				// @todo with proper row-loading in Query.Row with MariaDB 10.5+ - remove skipLoad,
				// and then re-fetch of new Portfolio ID
				await portfolioRow.save({ skipLoad: true });

				const portfolioID = await sb.Query.getRecordset(rs => rs
					.select("ID")
					.from("crypto_game", "Portfolio")
					.where("Owner = %n", context.user.ID)
					.where("Active = %b", true)
					.limit(1)
					.single()
					.flat("ID")
				);

				await updatePortfolioAsset(portfolioID, baseAsset, 1000);
				return {
					reply: `Your portfolio was established. You now have the equivalent of 1000 EUR at your disposal to invest.`
				};
			}

			case "average": {
				const average = await sb.Query.getRecordset(rs => rs
					.select("AVG(crypto_game.GET_PORTFOLIO_TOTAL_PRICE(Portfolio.ID)) AS Average")
					.from("crypto_game", "Portfolio")
					.where("Active = %b", true)
					.single()
					.flat("Average")
				);

				return {
					reply: `The current average portfolio value is €${sb.Utils.round(average, 3)}`
				};
			}

			case "assets":
			case "prices": {
				return {
					reply: `Check the available assets and their prices here: https://supinic.com/crypto-game/asset/list`
				};
			}

			case "leaderboard":
			case "portfolios": {
				return {
					reply: `Check the portfolio leaderboard here: https://supinic.com/crypto-game/portfolio/list`
				};
			}

			case "buy":
			case "sell": {
				if (!portfolioData) {
					return {
						success: false,
						reply: `You don't have a portfolio set up! Use $cg register to create one.`
					};
				}

				const [amount, asset] = args;
				const data = await parseArguments({ amount, asset });
				if (data.success === false) {
					return {
						success: false,
						reply: `${data.reply} -- Use $cg ${command} (amount) (asset)`
					};
				}

				let sourceAsset = baseAsset;
				let targetAsset = data.asset;
				let sourceAmount = data.amount * targetAsset.Price;
				if (command === "sell") {
					sourceAsset = data.asset;
					targetAsset = baseAsset;
					sourceAmount = data.amount;
				}

				if (data.amount === "all") {
					sourceAmount = portfolioData.assets.find(i => i.Code === sourceAsset.Code)?.Amount ?? 0;
				}
				else if (typeof data.amount === "string" && data.amount.includes("%")) {
					const percent = Number(data.amount.replace("%", ""));
					if (!Number.isFinite(percent)) {
						return {
							success: false,
							reply: `Invalid percentage provided!`
						};
					}

					const asset = portfolioData.assets.find(i => i.Code === sourceAsset.Code);
					const multiplier = sb.Utils.round(percent * 0.01, 4);

					sourceAmount = ((asset.Amount ?? 0) * multiplier);
				}

				if (sourceAsset.Code === targetAsset.Code) {
					return {
						success: false,
						reply: `You can't trade from and to the same currency!`
					};
				}
				if (sourceAmount === 0) {
					return {
						success: false,
						reply: `You can't ${command} 0 of any asset!`
					};
				}

				const assetCheck = await checkPortfolioAsset(portfolioData, sourceAsset, sourceAmount);
				if (assetCheck !== true) {
					return {
						success: false,
						reply: assetCheck
					};
				}

				const result = await createConvertTransaction(portfolioData, sourceAsset, targetAsset, sourceAmount);
				return {
					reply: sb.Utils.tag.trim `
						You successfully traded 
						${result.sourceAmount} ${sourceAsset.Code} 
						for 
						${result.targetAmount} ${targetAsset.Code}.
					`
				};
			}

			case "check":
			case "rank":
			case "total": {
				const [target] = args;

				let targetPortfolio;
				if (!target) {
					if (!portfolioData) {
						return {
							success: false,
							reply: `You don't have a portfolio set up! Use $cg register to create one.`
						};
					}

					targetPortfolio = portfolioData;
				}
				else {
					const targetUserData = await sb.User.get(target);
					if (!targetUserData) {
						return {
							success: false,
							reply: `Provided user does not exist!`
						};
					}

					const targetPortfolioData = await getPortfolioData(targetUserData.ID);
					if (!targetPortfolioData) {
						return {
							success: false,
							reply: `Provided user does not have an active portfolio!`
						};
					}

					targetPortfolio = targetPortfolioData;
				}

				const currencies = portfolioData.assets
					.filter(i => i.Amount > 0)
					.map(i => `${i.Code}: ${i.Amount}`).join("; ");

				const escaped = sb.Query.escapeString(targetPortfolio.ID);
				const [data] = await sb.Query.raw(
					`SELECT crypto_game.GET_PORTFOLIO_TOTAL_PRICE('${escaped}') AS Total`
				);

				const [rank, total] = await Promise.all([
					sb.Query.getRecordset(rs => rs
						.select("(COUNT(*) + 1) AS Rank")
						.from("crypto_game", "Portfolio")
						.where("Active = %b", true)
						.where("crypto_game.GET_PORTFOLIO_TOTAL_PRICE(ID) > %n", data.Total)
						.single()
						.flat("Rank")
					),
					sb.Query.getRecordset(rs => rs
						.select("COUNT(*) AS Total")
						.from("crypto_game", "Portfolio")
						.where("Active = %b", true)
						.single()
						.flat("Total")
					)
				]);

				const prefix = (target) ? "Their" : "Your";
				return {
					reply: `${prefix} portfolio: € ${data.Total} - rank ${rank}/${total}. Currencies: ${currencies}`
				};
			}
		}
	}),
	Dynamic_Description: (async (prefix) => [
		`<h4>The Crypto Game</h4>`,
		"Register your portfolio, receive some fake cash, invest it to various currencies and assets!",
		"Who will be the one to profit, or crash the most?",
		"Guaranteed - zero connection to real world, so you're not at risk of losing anything (besides your dignity).",
		"",

		"Playing this game does not entitle you to any currency in real life.",
		"Therefore, using this command is not gambling. You do not \"earn\" anything.",
		"",

		"This crypto-game uses euro (EUR, €) as the base currency.",
		"All transactions and commands use euro as the base.",
		"",

		"<h5>Main sub-commands</h5>",

		`<code>${prefix}cg register</code>`,
		"Registers you for the game, establishing your portfolio with 1000 EUR.",
		"",

		`<code>${prefix}cg buy (amount) (asset)</code>`,
		`<code>${prefix}cg buy 1 BTC</code>`,
		"Exchanges an equivalent amount of euros for however many of another asset you selected.",
		"",

		`<code>${prefix}cg sell (amount) (asset)</code>`,
		`<code>${prefix}cg sell 100 DOGE</code>`,
		"Exchanges an equivalent amount of whatever asset you selected back to euros.",
		"",

		`<code>${prefix}cg buy all (asset)</code>`,
		`<code>${prefix}cg sell all (asset)</code>`,
		"You can use the key word \"all\" to exchange all of the asset you have, instead of specifying an amount.",
		"",

		`<code>${prefix}cg buy 50% (asset)</code>`,
		`<code>${prefix}cg sell 12.5% (asset)</code>`,
		"You can use the percent symbol to buy/sell a relative amount of a given asset, instead of specifying an amount.",
		"",

		"<h5>Supplementary sub-commands</h5>",

		`<code>${prefix}cg average</code>`,
		`Fetches the average portfolio value.`,
		"",

		`<code>${prefix}cg check</code>`,
		`<code>${prefix}cg check (user)</code>`,
		`<code>${prefix}cg total</code>`,
		`<code>${prefix}cg total (user)</code>`,
		`<code>${prefix}cg rank</code>`,
		`<code>${prefix}cg rank (user)</code>`,
		`Shows the total converted cost of your (or a different users's) portfolio in euros, your/their rank and the list of their currencies.`,
		"",

		`<code>${prefix}cg assets</code>`,
		`<code>${prefix}cg prices</code>`,
		"Posts a link to the list of assets and their current prices.",
		`You can check it here: <a href="/crypto-game/asset/list">List</a>`,
		"",

		`<code>${prefix}cg portfolios</code>`,
		`<code>${prefix}cg leaderboard</code>`,
		"Posts a link to the list of portfolios, their owners, and the converted total prices.",
		`You can check it here: <a href="/crypto-game/portfolio/list">List</a>`,
		""
	])
};
