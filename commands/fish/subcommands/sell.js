import { COIN_EMOJI, itemTypeDefinitions, getInitialStats, itemTypes } from "./fishing-utils.js";
const fishEmojis = itemTypes.map(i => i.name);

/**
 * @todo Use `modifier` to allow selling multiple fish of a single type: $fish sell TYPE 5
 */

export default {
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
		`<code>$fish sell all junk</code>`,
		"Sells all of your fish or junk.",
		"",

		`<code>$fish sell duplicate fish</code>`,
		`<code>$fish sell duplicate junk</code>`,
		"Sells all but one of your fish or junk, keeping one exemplar for showcase purposes."
	],
	execute: async (context, specifier, modifier) => {
		/** @type {UserFishData} */
		const fishData = await context.user.getDataProperty("fishData") ?? getInitialStats();
		if (fishData.catch.fish === 0 && fishData.catch.junk === 0) {
			return {
				success: false,
				reply: `You have no items to sell!`
			};
		}

		if (specifier === "all" || specifier === "duplicate") {
			let coinsGained = 0;
			let itemsSold = 0;

			const itemTypeDefinition = itemTypeDefinitions.find(i => i.name === modifier);
			if (!itemTypeDefinition) {
				const types = itemTypeDefinitions.map(i => i.name).join(", ");
				return {
					success: false,
					reply: core.Utils.tag.trim `
						When selling all, you must provide a type!
						You don't wanna sell all of your stuff by accident, right?
						Use one of: ${types}
					`
				};
			}

			const threshold = (specifier === "all") ? 0 : 1;

			for (const itemData of itemTypes) {
				if (modifier !== itemData.type) {
					continue;
				}
				else if (!itemData.sellable) {
					continue;
				}

				const amount = fishData.catch.types[itemData.name] ?? 0;
				if (amount <= threshold) {
					continue;
				}

				const removeAmount = (specifier === "all") ? amount : (amount - 1);
				itemsSold += removeAmount;
				coinsGained += removeAmount * itemData.price;

				fishData.catch.types[itemData.name] = threshold;
				fishData.catch[itemData.type] -= removeAmount;

				if (itemData.type === "fish") {
					fishData.lifetime.sold += removeAmount;
				}
				else if (itemData.type === "junk") {
					fishData.lifetime.scrapped = (fishData.lifetime.scrapped ?? 0) + removeAmount;
				}
			}

			const prefix = (specifier === "duplicate") ? "duplicate " : "";
			if (coinsGained === 0) {
				return {
					success: false,
					reply: `You have no ${prefix}${itemTypeDefinition?.description ?? "items"} to sell!`
				};
			}

			fishData.coins += coinsGained;
			fishData.lifetime.coins += coinsGained;

			await context.user.setDataProperty("fishData", fishData);

			return {
				reply: core.Utils.tag.trim `
					You sold ${itemsSold} ${prefix}${itemTypeDefinition?.description ?? "items"} 
					for a grand total of ${coinsGained}${COIN_EMOJI}
					- now you have ${fishData.coins}${COIN_EMOJI}
				`
			};
		}
		else if (!fishEmojis.includes(specifier)) {
			return {
				success: false,
				reply: `You provided an unknown item type! Use one of: ${fishEmojis.join("")}`
			};
		}

		const itemAmount = fishData.catch.types[specifier];
		if (typeof itemAmount !== "number" || itemAmount === 0) {
			return {
				success: false,
				reply: `You have no ${specifier} to sell!`
			};
		}

		const itemData = itemTypes.find(i => i.name === specifier);
		if (!itemData.sellable) {
			return {
				success: false,
				reply: `You can't sell this ${specifier} - nobody would buy it!`
			};
		}

		let requestedAmount = Number(modifier);
		if (Number.isNaN(requestedAmount)) {
			requestedAmount = 1;
		}
		else if (!core.Utils.isValidInteger(requestedAmount, 1)) {
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

		fishData.catch.types[specifier] -= sellAmount;
		fishData.catch[itemData.type] -= sellAmount;

		if (itemData.type === "fish") {
			fishData.lifetime.sold += sellAmount;
		}
		else if (itemData.type === "junk") {
			fishData.lifetime.scrapped = (fishData.lifetime.scrapped ?? 0) + sellAmount;
		}

		const coinsGained = sellAmount * itemData.price;
		fishData.coins += coinsGained;
		fishData.lifetime.coins += coinsGained;

		await context.user.setDataProperty("fishData", fishData);

		return {
			reply: `Sold your ${specifier}${suffix} for ${coinsGained}${COIN_EMOJI} - now you have ${fishData.coins}${COIN_EMOJI}`
		};
	}
};
