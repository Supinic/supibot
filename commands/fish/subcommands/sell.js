const { COIN_EMOJI, itemTypeDefinitions, getInitialStats, itemTypes } = require("./fishing-utils.js");
const fishEmojis = itemTypes.map(i => i.name);

/**
 * @todo Use `modifier` to allow selling multiple fish of a single type: $fish sell TYPE 5
 */

module.exports = {
	name: "sell",
	aliases: [],
	description: [
		`<code>$fish sell (item)</code>`,
		`<code>$fish sell 🐡</code>`,
		"Sell one of your fishing trophies (or junk) for coins.",
		"",

		`<code>$fish sell (item) (amount)</code>`,
		`<code>$fish sell 🧦 10</code>`,
		"Sell several of your fishing trophies (or pieces of junk) at once.",
		"",

		`<code>$fish sell all fish</code>`,
		"Sells all of your fish.",
		"",

		`<code>$fish sell all junk</code>`,
		"Sells all of your junk."
	],
	execute: async (context, fishType, modifier) => {
		/** @type {UserFishData} */
		const fishData = await context.user.getDataProperty("fishData") ?? getInitialStats();
		if (fishData.catch.fish === 0 && fishData.catch.junk === 0) {
			return {
				success: false,
				reply: `You have no items to sell!`
			};
		}

		if (fishType === "all") {
			let coinsGained = 0;
			let itemsSold = 0;

			const itemTypeDefinition = itemTypeDefinitions.find(i => i.name === modifier);
			if (!itemTypeDefinition) {
				const types = itemTypeDefinitions.map(i => i.name).join(", ");
				return {
					success: false,
					reply: sb.Utils.tag.trim `
						When selling all, you must provide a type!
						You don't wanna sell all of your stuff by accident, right?
						Use one of: ${types}
					`
				};
			}

			for (const itemData of itemTypes) {
				if (modifier !== itemData.type) {
					continue;
				}
				else if (!itemData.sellable) {
					continue;
				}

				const amount = fishData.catch.types[itemData.name] ?? 0;
				if (amount <= 0) {
					continue;
				}

				itemsSold += amount;
				coinsGained += amount * itemData.price;

				fishData.catch.types[itemData.name] = 0;
				fishData.catch[itemData.type] -= amount;

				if (itemData.type === "fish") {
					fishData.lifetime.sold += amount;
				}
				else if (itemData.type === "junk") {
					fishData.lifetime.scrapped = (fishData.lifetime.scrapped ?? 0) + amount;
				}
			}

			if (coinsGained === 0) {
				return {
					success: false,
					reply: `You have no ${itemTypeDefinition?.description ?? "items"} to sell!`
				};
			}

			fishData.coins += coinsGained;
			fishData.lifetime.coins += coinsGained;

			await context.user.setDataProperty("fishData", fishData);

			return {
				reply: sb.Utils.tag.trim `
					You sold ${itemsSold} ${itemTypeDefinition?.description ?? "items"} 
					for a grand total of ${coinsGained}${COIN_EMOJI}
				`
			};
		}
		else if (!fishEmojis.includes(fishType)) {
			return {
				success: false,
				reply: `You provided an unknown item type! Use one of: ${fishEmojis.join("")}`
			};
		}

		const itemAmount = fishData.catch.types[fishType];
		if (typeof itemAmount !== "number" || itemAmount === 0) {
			return {
				success: false,
				reply: `You have no ${fishType} to sell!`
			};
		}

		const itemTypeData = itemTypes.find(i => i.name === fishType);
		if (!itemTypeData.sellable) {
			return {
				success: false,
				reply: `You can't sell this ${fishType} - nobody would buy it!`
			};
		}

		let requestedAmount = Number(modifier);
		if (Number.isNaN(requestedAmount)) {
			requestedAmount = 1;
		}
		else if (!sb.Utils.isValidInteger(requestedAmount, 1)) {
			return {
				success: false,
				reply: `You provided an invalid amount of items to sell! You need to use a positive integer (a whole number).`
			};
		}

		let suffix = "";
		const sellAmount = Math.min(itemAmount, requestedAmount);
		if (sellAmount > 1) {
			suffix = ` x${sellAmount}`;
		}

		fishData.catch.types[fishType] -= sellAmount;
		fishData.catch[itemTypeData.type] -= sellAmount;
		fishData.lifetime.sold += sellAmount;

		const coinsGained = sellAmount * itemTypeData.price;
		fishData.coins += coinsGained;
		fishData.lifetime.coins += coinsGained;

		await context.user.setDataProperty("fishData", fishData);

		return {
			reply: `Sold your ${fishType}${suffix} for ${coinsGained}${COIN_EMOJI} - now you have ${fishData.coins}${COIN_EMOJI}.`
		};
	}
};
