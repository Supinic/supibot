const { CronJob } = require("cron");

module.exports = {
	Name: "cryptogame",
	Aliases: ["cg"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Crypto game command! Receive the equivalent of €1000 on your \"portfolio\" and invest them into various currencies and assets to see how well you can increase your worth. Who shall become the best investor Supibot-land has ever known?",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	initialize: function () {
		const { cryptoGamePriceUpdate } = require("./update-prices-cron.js");
		this.data.updateCronJob = new CronJob("0 0 * * * *", () => cryptoGamePriceUpdate());
		this.data.updateCronJob.start();
	},
	destroy: function () {
		this.data.updateCronJob.stop();
		this.data.updateCronJob = null;
	},
	Code: async function cryptoGame (context, command, ...args) {
		const {
			availableCommands,
			baseAsset,
			checkPortfolioAsset,
			createConvertTransaction,
			getPortfolioData,
			parseArguments,
			updatePortfolioAsset
		} = require("./game.js");

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
					if (!asset) {
						return {
							success: false,
							reply: `You don't have any ${sourceAsset.Code}!`
						};
					}

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

				const currencies = targetPortfolio.assets
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
	},
	Dynamic_Description: async (prefix) => [
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
		`Shows the total converted cost of your (or a different user's) portfolio in euros, your/their rank and the list of their currencies.`,
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
	]
};
