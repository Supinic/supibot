const { COIN_EMOJI, getInitialStats, hasFishedBefore, itemTypes, itemTypeDefinitions } = require("./fishing-utils.js");
const defaultShowType = itemTypeDefinitions.find(i => i.name === "fish");

module.exports = {
	name: "show",
	aliases: ["count", "display", "collection"],
	description: [
		`<code>$fish show</code>`,
		`<code>$fish show fish</code>`,
		"Show off your fishing trophy collection and your coins.",
		"",

		`<code>$fish show junk</code>`,
		"Check out your junk 'collection' and coins.",
		"",

		`<code>$fish show (user)</code>`,
		`<code>$fish show (user) fish</code>`,
		`<code>$fish show @Supinic</code>`,
		"Check out another user's fishing collection and coins.",
		"",

		`<code>$fish show (user) junk</code>`,
		`<code>$fish show @Supinic</code>`,
		"Check out another user's junk collection specifically",

		`<code>$fish show (user) (fish or junk emoji)</code>`,
		`<code>$fish show @Supinic 💀</code>`,
		`<code>$fish show @Supinic 🐳</code>`,
		"Check out another user's collection of a specific piece of fish (catch) or junk."
	],
	execute: async (context, userOrType, optionalType) => {
		let catchTypeData = null;
		let showTypeData = defaultShowType;
		let targetUserData = context.user;

		if (userOrType) {
			if (itemTypeDefinitions.some(i => i.name === userOrType)) {
				showTypeData = itemTypeDefinitions.find(i => i.name === userOrType);
			}
			else {
				targetUserData = await sb.User.get(userOrType);
				if (!targetUserData) {
					return {
						success: false,
						reply: `No such user exists!`
					};
				}
			}

			if (targetUserData && optionalType) {
				const catchType = itemTypeDefinitions.find(i => i.name === optionalType);
				if (catchType) {
					showTypeData = catchType;
				}
				else {
					catchTypeData = itemTypes.find(i => i.name === optionalType);
					if (!catchTypeData) {
						return {
							success: false,
							reply: `You must provide a proper catch type (fish or junk) or a proper catch emoji!`
						};
					}
				}
			}

			if (targetUserData.Name === context.platform.Self_Name) {
				return {
					success: false,
					reply: `I can't go fishing, if water splashed around it would damage my circuits! 😨`
				};
			}
		}

		/** @type {UserFishData} */
		const fishData = await targetUserData.getDataProperty("fishData") ?? getInitialStats();
		const [subject, possessive] = (targetUserData === context.user)
			? ["You", "your"]
			: ["They", "their"];

		if (!hasFishedBefore(fishData)) {
			return {
				reply: `${subject} have never gone fishing before.`
			};
		}

		if (catchTypeData) {
			const itemAmount = fishData.catch.types[catchTypeData.name];
			let itemString;
			if (!itemAmount) {
				itemString = "no";
			}
			else if (itemAmount < 5) {
				itemString = `${catchTypeData.name} `.repeat(itemAmount);
			}
			else {
				itemString = `${itemAmount}x ${catchTypeData.name}`;
			}

			return {
				reply: `${subject} have ${itemString} in ${possessive} collection.`
			};
		}
		else {
			const itemTypeAmount = fishData.catch[showTypeData.name] ?? 0;
			if (itemTypeAmount <= 0) {
				return {
					reply: sb.Utils.tag.trim `
						${subject} have no ${showTypeData.description} in ${possessive} collection,
						and ${possessive} purse contains ${fishData.coins}${COIN_EMOJI}.
					`
				};
			}

			const result = [];
			for (const [itemEmoji, count] of Object.entries(fishData.catch.types)) {
				if (count <= 0) {
					continue;
				}

				const itemData = itemTypes.find(i => i.name === itemEmoji);
				if (itemData.type !== showTypeData.name) {
					continue;
				}

				if (count < 5) {
					result.push(itemEmoji.repeat(count));
				}
				else {
					result.push(`${count}x ${itemEmoji}`);
				}
			}

			return {
				reply: sb.Utils.tag.trim `
					${subject} have ${itemTypeAmount} ${showTypeData.description} in ${possessive} collection.
					Here they are: ${result.join("")}
					${subject} also have ${fishData.coins}${COIN_EMOJI} in ${possessive} purse.
				`
			};
		}
	}
};
