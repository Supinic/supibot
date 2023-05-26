const { COIN_EMOJI, getInitialStats, fishTypes } = require("./fishing-utils.js");
const fishEmojis = fishTypes.map(i => i.name);

module.exports = {
	name: "sell",
	aliases: [],
	description: [
		`<code>$fish sell (fish)</code>`,
		`<code>$fish sell 🐡</code>`,
		"Sell one of your fishing trophies for coins.",
		"Those can then be used to buy bait (and more goodies in the future)."
	],
	execute: async (context, fishType) => {
		/** @type {UserFishData} */
		const fishData = await context.user.getDataProperty("fishData") ?? getInitialStats();
		if (fishData.catch.total === 0) {
			return {
				success: false,
				reply: `You have no fish to sell!`
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

		const fishTypeData = fishTypes.find(i => i.name === fishType);
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
