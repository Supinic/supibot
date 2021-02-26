module.exports = {
    Name: "cryptogame",
    Aliases: ["cg"],
    Author: "supinic",
    Cooldown: 5000,
    Description: "Beta test of the fabled SupiCryptoGame™. Feel free to test, but your portfolios will probably get reset on full release! ",
    Flags: ["mention","non-nullable","pipe"],
    Params: null,
    Whitelist_Response: null,
    Static_Data: (() => {
        this.data.updateCron = new sb.Cron({
            Name: "crypto-game-price-updater",
            Description: "Regularly updates the prices used in the crypto-game command.",
            Expression: "0 0 */12 * * *",
            Code: (async function cryptoGamePriceUpdate () {
                const totalData = {};
                const [cryptoData, currencyData, goldData, silverData] = await Promise.all([
                    sb.Got({
                        url: "https://min-api.cryptocompare.com/data/price",
                        searchParams: new sb.URLParams()
                            .set("fsym", "EUR")
                            .set("tsyms", "BTC,XRP,DOGE,ETH,BCH,LTC,EOS,XLM,BNB,USDT,DOT,ADA,LINK")
                            .toString(),
                        headers: {
                            Authorization: "Apikey " + sb.Config.get("API_CRYPTO_COMPARE")
                        }
                    }).json(),

                    sb.Got({
                        prefixUrl: "http://data.fixer.io/api",
                        url: "latest",
                        throwHttpErrors: false,
                        responseType: "json",
                        searchParams: new sb.URLParams()
                            .set("access_key", sb.Config.get("API_FIXER_IO"))
                            .toString()
                    }).json(),

                    sb.Got({
                        url: "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/EUR",
                    }).json(),

                    sb.Got({
                        url: "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAG/EUR",
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

                    const row = await sb.Query.getRow("crypto_game", "Asset");
                    await row.load(code, true);
                    if (!row.values.Code) {
                        row.values.Code = code;
                    }

                    const adjustedValue = (code === "XAU" || code === "XAG")
                        ? value
                        : (1 / value);

                    row.values.Price = sb.Utils.round(adjustedValue, 9, { direction: "floor" });
                    row.values.Last_Update = now;
                    await row.save();
                });

                await Promise.all(promises);
            })
        });
        this.data.updateCron.start();

        const baseAsset = {
            Code: "EUR",
            Price: 1
        };

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
                assets: data
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
                            reply: "Invalid asset provided!"
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

            return result;
        };

        const checkPortfolioAsset = (portfolioData, assetData, amount) => {
            const asset = portfolioData.assets.find(i => i.Code === assetData.Code);
            if (!asset) {
                return `You don't have any ${assetData.Code}!`;
            }
            else {
                if (asset.Amount < amount) {
                    return `You don't have enough ${assetData.Code}! You have ${asset.Amount}, and need ${amount}.`;
                }
                else {
                    return true;
                }
            }
        };

        const updatePortfolioAsset = async (portfolioData, assetData, amount) => {
            if (typeof portfolioData === "string") {
                portfolioData = await getPortfolioData(portfolioData);
            }

            const targetAsset = portfolioData.assets.find(i => i.Code === assetData.Code);

            console.log("updating portfolio", { portfolioData, assetData, amount});

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
                await row.save();
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
                Target_Amount: amount,
            });

            await Promise.all([
                row.save(),
                updatePortfolioAsset(sourcePortfolio, assetData, -amount),
                updatePortfolioAsset(targetPortfolio, assetData, amount)
            ]);
        };

        const createConvertTransaction = async (portfolioData, sourceAsset, targetAsset, rawSourceAmount) => {
            const sourceAmount = sb.Utils.round(rawSourceAmount, 9, { direction: "floor" });
            const exchangeRate = sb.Utils.round(targetAsset.Price / sourceAsset.Price, 9, { direction: "floor" });
            const targetAmount = sb.Utils.round(sourceAmount / exchangeRate, 9, { direction: "floor" });

            const row = await sb.Query.getRow("crypto_game", "Transaction");
            row.setValues({
                Source_Portfolio: portfolioData.ID,
                Source_Asset: sourceAsset.Code,
                Source_Amount: sourceAmount,
                Exchange_Rate: exchangeRate,
                Target_Portfolio: portfolioData.ID,
                Target_Asset: targetAsset.Code,
                Target_Amount: targetAmount,
            });

            await Promise.all([
                row.save(),
                updatePortfolioAsset(portfolioData, sourceAsset, -sourceAmount),
                updatePortfolioAsset(portfolioData, targetAsset, targetAmount)
            ]);

            return {
                exchangeRate,
                targetAmount
            };
        };

        return {
            availableCommands: ["assets", "buy", "check", "register", "prices", "sell", "send", "total"],
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
            createTransferTransaction,
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

        // Special case for register - it is the only command that works without any portfolioData
        if (command === "register") {
            const portfolios = await getPortfolioData(context.user.ID);
            if (portfolios) {
                return {
                    success: false,
                    reply: "You already registered for a portfolio!"
                };
            }

            const portfolioRow = await sb.Query.getRow("crypto_game", "Portfolio");
            portfolioRow.values.Owner = context.user.ID;
            await portfolioRow.save();

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
        else if (command === "assets" || command === "prices") {
            return {
                reply: `Check the available assets and their prices here: https://supinic.com/crypto-game/asset/list`
            };
        }

        const portfolioData = await getPortfolioData(context.user.ID);
        if (!portfolioData) {
            return {
                success: false,
                reply: `You don't have a portfolio set up! Use $cg register to create one.`
            };
        }

        switch (command) {
            case "check": {
                const accountString = portfolioData.assets
                    .filter(i => i.Amount > 0)
                    .map(i => `${i.Code}: ${i.Amount}`).join("; ");

                return {
                    reply: `Your portfolio: ${accountString}`
                };
            }

            case "send": {
                const [user, amount, asset] = args;
                const data = await parseArguments({ user, amount, asset });
                if (data.success === false) {
                    return {
                        success: false,
                        reply: data.reply + " Use $cg send (user) (amount) (asset)"
                    };
                }

                const targetPortfolioData = await getPortfolioData(data.user.ID);
                if (!targetPortfolioData) {
                    return {
                        success: false,
                        reply: `That user has not registered yet! First, they must use $cg register.`
                    };
                }

                const assetCheck = await checkPortfolioAsset(portfolioData, data.asset, amount);
                if (assetCheck !== true) {
                    return {
                        success: false,
                        reply: assetCheck
                    };
                }

                await createTransferTransaction(portfolioData, targetPortfolioData, data.asset, amount);

                return {
                    reply: `Successfully sent ${amount} ${data.asset.Code} to ${data.user.Name}.`
                };
            }

            case "buy":
            case "sell": {
                const [amount, asset] = args;
                const data = await parseArguments({ amount, asset });
                if (data.success === false) {
                    return {
                        success: false,
                        reply: `${data.reply} Use $cg ${command} (amount) (asset)`
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

                if (sourceAsset.Code === targetAsset.Code) {
                    return {
                        success: false,
                        reply: `You can't trade from and to the same currency!`
                    };
                }

                console.log({ portfolioData, sourceAsset, targetAsset, sourceAmount, data });

                const assetCheck = await checkPortfolioAsset(portfolioData, sourceAsset, sourceAmount);
                if (assetCheck !== true) {
                    return {
                        success: false,
                        reply: assetCheck
                    };
                }

                const result = await createConvertTransaction(portfolioData, sourceAsset, targetAsset, sourceAmount);

                return {
                    reply: `You successfully traded ${sourceAmount} ${sourceAsset.Code} for ${result.targetAmount} ${targetAsset.Code}.`
                };
            }
            
            case "total": {
                const escaped = sb.Query.escapeString(portfolioData.ID);
                const [data] = await sb.Query.raw(
                    `SELECT crypto_game.GET_PORTFOLIO_TOTAL_PRICE('${escaped}') AS Total`
                );

                return {
                    reply: `Your current total: € ${data.Total}`
                };
            }
        }
    }),
    Dynamic_Description: null
};