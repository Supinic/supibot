const { getInitialStats, fishTypes } = require("./fishing-utils.js");

module.exports = {
	name: "sell",
	aliases: [],
	description: [],
	execute: async (context, fishType) => {
		/** @type {UserFishData} */
		const fishData = await context.user.getDataProperty("fishData") ?? getInitialStats();
		if (fishData.catch.total === 0) {
			return {
				success: false,
				reply: `You have no fish to sell!`
			};
		}
		else if (!fishTypes.includes(fishType)) {
			return {
				success: false,
				reply: `Invalid fish provided! Use one of: ${fishTypes.join(", ")}`
			};
		}

		const existingFish = fishData.catch.types[fishType];
		if (typeof existingFish !== "number" || existingFish === 0) {
			return {
				success: false,
				reply: `You have no ${fishType} to sell!`
			};
		}

		fishData.catch.types[fishType]--;
		fishData.catch.total--;

		fishData.coins += 50;
		fishData.lifetime.coins += 50;

		await context.user.setDataProperty("fishData", fishData);

		return {
			reply: `Sold your ${fishType} for 50🪙 - now you have ${fishData.coins}🪙.`
		};
	}
};
