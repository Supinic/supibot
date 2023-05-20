const { getInitialStats } = require("./fishing-utils.js");

module.exports = {
	name: "show",
	aliases: ["count", "display", "collection"],
	description: [
		`<code>$fish show</code>`,
		"Show off your fishing trophy collection."
	],
	execute: async (context) => {
		/** @type {UserFishData} */
		const fishData = await context.user.getDataProperty("fishData") ?? getInitialStats();
		if (fishData.catch.total === 0) {
			return {
				reply: `You have no fish in your collection.`
			};
		}

		const result = [];
		for (const [fishType, count] of Object.entries(fishData.catch.types)) {
			if (count < 5) {
				result.push(fishType.repeat(count));
			}
			else {
				result.push(`${count}x ${fishType}`);
			}
		}

		return {
			reply: `You have ${fishData.catch.total} fish in your collection. Here they are: ${result.join("")}`
		};
	}
};
