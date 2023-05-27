const { COIN_EMOJI, itemTypeDefinitions, getInitialStats, itemTypes } = require("./fishing-utils.js");
const fishEmojis = itemTypes.map(i => i.name);

module.exports = {
	name: "sell",
	aliases: [],
	description: [
		`<code>$fish sell (fish)</code>`,
		`<code>$fish sell 🐡</code>`,
		"Sell one of your fishing trophies for coins.",
		"Those can then be used to buy bait (and more goodies in the future).",
		"",

		`<code>$fish sell all</code>`,
		"Sells all of your catches, no matter what they are.",
		"",

		`<code>$fish sell all (type)</code>`,
		`<code>$fish sell all fish</code>`,
		`<code>$fish sell all junk</code>`,
		"Sells all of your catches, depending on what type you chose."
	],
	execute: async (context, fishType, modifier) => {
		/** @type {UserFishData} */
		const fishData = await context.user.getDataProperty("fishData") ?? getInitialStats();
		if (fishData.catch.total === 0) {
			return {
				success: false,
				reply: `You have no fish to sell!`
			};
		}

		if (fishType === "all") {
			let coinsGained = 0;
			let itemsSold = 0;

			const itemType = itemTypeDefinitions.find(i => i.name === modifier);
			for (const itemData of itemTypes) {
				if (itemType && modifier !== itemType.name) {
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
				fishData.catch.total -= amount;
				fishData.coins += coinsGained;

				fishData.lifetime.sold += amount;
				fishData.lifetime.coins += coinsGained;
			}

			if (coinsGained === 0) {
				return {
					success: false,
					reply: `You have no ${itemType.description ?? "items"} to sell!`
				};
			}

			await context.user.setDataProperty("fishData", fishData);

			return {
				reply: `You sold ${itemsSold} ${itemType.description ?? "items"} for a grand total of ${coinsGained}${COIN_EMOJI}`
			};
		}
		else if (!fishEmojis.includes(fishType)) {
			return {
				success: false,
				reply: `Invalid fish provided! Use one of: ${fishEmojis.join("")}`
			};
		}

		const existingFish = fishData.catch.types[fishType];
		if (typeof existingFish !== "number" || existingFish === 0) {
			return {
				success: false,
				reply: `You have no ${fishType} to sell!`
			};
		}

		const fishTypeData = itemTypes.find(i => i.name === fishType);
		if (!fishTypeData.sellable) {
			return {
				success: false,
				reply: `You can't sell this ${fishType} - nobody would buy it!`
			};
		}

		fishData.catch.types[fishType]--;
		fishData.catch.total--;

		fishData.coins += 50;
		fishData.lifetime.coins += 50;
		fishData.lifetime.sold++;

		await context.user.setDataProperty("fishData", fishData);

		return {
			reply: `Sold your ${fishType} for 50${COIN_EMOJI} - now you have ${fishData.coins}🪙.`
		};
	}
};
