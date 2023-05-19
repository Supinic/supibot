const { baitTypes, getInitialStats, fishTypes } = require("./fishing-utils.js");
const { checkLimits } = require("../../gpt/cache-control.js");
const randomWords = require("../../randomword/words.json");

const gptStyles = ["exciting", "spooky", "smug", "radical", "insane", "hilarious", "infuriating"];
const getRandomWords = (amount) => {
	const result = new Set();
	for (let i = 0; i < amount; i++) {
		result.add(sb.Utils.randArray(randomWords));
	}

	return [...result];
};
const createGptPrompt = (executor, resultFish) => sb.Utils.tag.trim `
	Write a short fishing story (200 characters or less),
	where a user named ${executor} catches a ${resultFish} in the water and keeps it! 
	Keep it short but somewhat ${sb.Utils.randArray(gptStyles)}, 
	and include the following words or themes: ${getRandomWords(3).join(", ")}
`;

module.exports = {
	name: "fish",
	default: true,
	aliases: [],
	description: [],
	execute: async (context, ...args) => {
		/** @type {UserFishData} */
		const fishData = await context.user.getDataProperty("fishData") ?? getInitialStats();
		if (fishData.readyTimestamp !== 0 && sb.Date.now() < fishData.readyTimestamp) {
			return {
				success: false,
				reply: `Hold up partner! You can go fishing again ${sb.Utils.timeDelta(fishData.readyTimestamp)}!`
			};
		}

		let rollChance = 20;
		const [selectedBait] = args;
		if (selectedBait) {
			const baitIndex = baitTypes.indexOf(selectedBait);
			if (baitIndex === -1) {
				return {
					success: false,
					reply: `You selected invalid fishing bait! Try one of these: ${baitTypes.join(", ")}`
				};
			}

			const baitPrice = 2 + (3 * baitIndex);
			if (fishData.coins < baitPrice) {
				return {
					success: false,
					reply: `You need ${baitPrice}🪙 for one ${selectedBait}! (you have ${fishData.coins}🪙)`
				};
			}

			fishData.coins -= baitPrice;
			rollChance -= (2 * baitIndex) + 4;
		}

		let appendix = "";
		if (selectedBait) {
			appendix = `, used ${selectedBait}, ${fishData.coins}🪙 left`;
		}

		fishData.lifetime.attempts++;

		const roll = sb.Utils.random(1, rollChance);
		if (roll !== 1) {
			fishData.readyTimestamp = sb.Date.now() + 30000;
			await context.user.setDataProperty("fishData", fishData);

			const missDistance = sb.Utils.random(1, 10000) / 100;
			return {
				success: false,
				reply: `No luck... ${missDistance} cm away (30s cooldown${appendix})`
			};
		}

		const caughtFish = sb.Utils.randArray(fishTypes);
		fishData.catch.total++;
		fishData.catch.types[caughtFish] ??= 0;
		fishData.catch.types[caughtFish]++;

		fishData.readyTimestamp = sb.Date.now() + 18e5; // 30 minutes
		fishData.lifetime.fish++;

		await context.user.setDataProperty("fishData", fishData);

		const gptLimitResult = await checkLimits(context.user);
		if (sb.Command.get("gpt") && gptLimitResult.success) {
			const gptCommand = sb.Command.get("gpt");
			const prompt = createGptPrompt(context.user.Name, caughtFish);
			const fauxContext = sb.Command.createFakeContext(gptCommand, {
				user: context.user,
				channel: context.channel,
				platform: context.platform,
				params: {
					temperature: 1
				}
			});

			const result = await sb.Command.get("gpt").execute(fauxContext, prompt);
			const fixedResult = result.reply.replace("🤖", "");

			return {
				reply: `✨${caughtFish}✨! ${fixedResult} (30m cooldown${appendix})`
			};
		}
		else {
			return {
				reply: sb.Utils.tag.trim `
					You caught a ✨${caughtFish}✨!
					Now go do something productive! 
					(30m cooldown after a catch) 
					(no story because you don't have ChatGPT tokens remaining)
				`
			};
		}
	}
};

/**
 * @typedef {Object} UserFishData
 * @property {Object} lifetime
 * @property {number} lifetime.fish
 * @property {number} lifetime.coins
 * @property {number} lifetime.attempts
 * @property {Object} catch
 * @property {number} catch.total
 * @property {Record<string, number>} catch.types
 * @property {number} readyTimestamp
 * @property {number} coins
 */
