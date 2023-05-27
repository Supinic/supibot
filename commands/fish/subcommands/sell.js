const { COIN_EMOJI, itemTypeDefinitions, getInitialStats, itemTypes } = require("./fishing-utils.js");
const fishEmojis = itemTypes.map(i => i.name);

/**
 * @todo Use `modifier` to allow selling multiple fish of a single type: $fish sell TYPE 5
 */

module.exports = {
	name: "sell",
	aliases: [],
	description: [
		`<code>$fish sell (fish)</code>`,
		`<code>$fish sell 🐡</code>`,
		"Sell one of your fishing trophies for coins.",
		"Those can then be used to buy bait (and more goodies in the future).",
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
					reply: `When selling all, you must provide a type! Use one of: ${types}`
				};
			}

			for (const itemData of itemTypes) {
				if (itemTypeDefinition && modifier !== itemData.name) {
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
				fishData.coins += coinsGained;

				if (itemData.name === "fish") {
					fishData.lifetime.sold += amount;
				}
				else if (itemData.name === "junk") {
					fishData.lifetime.scrapped = (fishData.lifetime.scrapped ?? 0) + amount;
				}

				fishData.lifetime.coins += coinsGained;
			}

			if (coinsGained === 0) {
				return {
					success: false,
					reply: `You have no ${itemTypeDefinition?.description ?? "items"} to sell!`
				};
			}

			await context.user.setDataProperty("fishData", fishData);

			return {
				reply: `You sold ${itemsSold} ${itemTypeDefinition?.description ?? "items"} for a grand total of ${coinsGained}${COIN_EMOJI}`
			};
		}
		else if (!fishEmojis.includes(fishType)) {
			return {
				success: false,
				reply: `Invalid fish provided! Use one of: ${fishEmojis.join("")}`
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

		fishData.catch.types[fishType]--;
		fishData.catch[itemTypeData.type]--;

		fishData.coins += itemTypeData.price;
		fishData.lifetime.coins += itemTypeData.price;
		fishData.lifetime.sold++;

		await context.user.setDataProperty("fishData", fishData);

		return {
			reply: `Sold your ${fishType} for ${itemTypeData.price}${COIN_EMOJI} - now you have ${fishData.coins}${COIN_EMOJI}.`
		};
	}
};
