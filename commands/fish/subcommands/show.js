const { COIN_EMOJI, getInitialStats } = require("./fishing-utils.js");

module.exports = {
	name: "show",
	aliases: ["count", "display", "collection"],
	description: [
		`<code>$fish show</code>`,
		"Show off your fishing trophy collection and your coins.",
		"",

		`<code>$fish show (user)</code>`,
		`<code>$fish show @Supinic</code>`,
		"Check out another user's fishing collection and coins."
	],
	execute: async (context, user) => {
		const targetUserData = (user)
			? await sb.User.get(user)
			: context.user;

		if (!targetUserData) {
			return {
				success: false,
				reply: `No such user exists!`
			};
		}

		/** @type {UserFishData} */
		const fishData = await targetUserData.getDataProperty("fishData") ?? getInitialStats();
		const [subject, possessive] = (targetUserData === context.user)
			? ["You", "your"]
			: ["They", "their"];

		if (fishData.lifetime.attempts === 0) {
			return {
				reply: `${subject} have never gone fishing before.`
			};
		}
		else if (fishData.catch.total === 0) {
			return {
				reply: `${subject} have no fish in ${possessive} collection.`
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
			reply: sb.Utils.tag.trim `
				${subject} have ${fishData.catch.total} fish in ${possessive} collection.
				Here they are: ${result.join("")}
				${subject} also have ${fishData.coins}${COIN_EMOJI} in ${possessive} purse.
			`
		};
	}
};
