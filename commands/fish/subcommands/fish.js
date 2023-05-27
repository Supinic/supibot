const { baitTypes, COIN_EMOJI, getEmote, getInitialStats, itemTypes } = require("./fishing-utils.js");
const { checkLimits } = require("../../gpt/cache-control.js");

const gptStyles = ["exciting", "spooky", "smug", "radical", "insane", "hilarious", "infuriating"];
const createGptPrompt = (executor, resultFish, sizeString) => sb.Utils.tag.trim `
	Write a short story where a user named "${executor}"
	catches a ${resultFish} in the water and keeps it! 
	${sizeString}
	Make it very concise - a maximum of 150 characters.
    The writing style should be ${sb.Utils.randArray(gptStyles)}.
`;

const formatDelay = (delay) => sb.Utils.timeDelta(sb.Date.now() + delay, true);

const successfulFishDelay = 1; // 18e5 - 30 min
const unsuccessfulFishDelay = [25_000, 55_000];
const baitDisplay = baitTypes.map(i => `<code>${i.name}</code> ${i.emoji} (${i.price} coins)`).join(" - ");

module.exports = {
	name: "fish",
	default: true,
	aliases: [],
	description: [
		`<code>$fish</code>`,
		"Go fishing!",
		"",

		`<code>$fish (bait)</code>`,
		`<code>$fish 🦗</code>`,
		`<code>$fish cricket</code>`,
		"Buy bait before heading out to fish, to increase your odds.",
		"The bait is immediately used as you go fishing, and cannot be used later.",
		`Available bait types: ${baitDisplay}`,
		"",

		`<code>$fish skipStory:true</code>`,
		"Does not generate a GPT story about your fishing results, if successful."
	],
	execute: async (context, ...args) => {
		/** @type {UserFishData} */
		const fishData = await context.user.getDataProperty("fishData") ?? getInitialStats();
		if (fishData.readyTimestamp !== 0 && sb.Date.now() < fishData.readyTimestamp) {
			return {
				success: false,
				reply: `Hol' up partner! You can go fishing again ${sb.Utils.timeDelta(fishData.readyTimestamp)}!`
			};
		}

		let rollMaximum = 1;
		let appendix = "";
		if (args.length > 0) {
			const [selectedBait] = args;
			const baitData = baitTypes.find(i => i.name === selectedBait || i.emoji === selectedBait);
			if (baitData) {
				if (fishData.coins < baitData.price) {
					return {
						success: false,
						reply: `You need ${baitData.price}${COIN_EMOJI} for one ${selectedBait}! (you have ${fishData.coins}${COIN_EMOJI})`
					};
				}

				rollMaximum = baitData.roll;
				fishData.coins -= baitData.price;
				fishData.lifetime.baitUsed++;

				appendix = `, used ${args[0]}, ${fishData.coins}${COIN_EMOJI} left`;
			}
		}

		// Clamp the roll chance in the case of unexpected/untested bonuses
		if (rollMaximum < 1) {
			rollMaximum = 1;
		}

		fishData.lifetime.attempts++;

		const roll = sb.Utils.random(1, rollMaximum);
		if (roll !== 1) {
			const fishingDelay = sb.Utils.round(sb.Utils.random(...unsuccessfulFishDelay), -3);

			fishData.catch.dryStreak++;
			fishData.catch.luckyStreak = 0;
			fishData.readyTimestamp = sb.Date.now() + fishingDelay + 1000;

			if (fishData.catch.dryStreak > fishData.lifetime.dryStreak) {
				fishData.lifetime.dryStreak = fishData.catch.dryStreak;
			}

			await context.user.setDataProperty("fishData", fishData);

			let streakString = "";
			const { dryStreak } = fishData.catch;
			if (dryStreak >= 3) {
				streakString = ` This is your attempt #${dryStreak} since your last catch.`;
			}

			const emote = await getEmote(context, "failure");
			const missDistance = sb.Utils.random(1, 500);
			return {
				success: false,
				reply: sb.Utils.tag.trim `
					No luck... ${emote}
					Your bobber landed ${missDistance} cm away.
					(${formatDelay(fishingDelay)} cooldown${appendix})
					${streakString}
				`
			};
		}

		const caughtFishData = sb.Utils.randArray(itemTypes);
		const fishType = caughtFishData.name;

		fishData.catch.total++;
		fishData.catch.types[fishType] ??= 0;
		fishData.catch.types[fishType]++;
		fishData.lifetime.fish++;

		fishData.catch.dryStreak = 0;
		fishData.catch.luckyStreak++;
		if (fishData.catch.luckyStreak > fishData.lifetime.luckyStreak) {
			fishData.lifetime.luckyStreak = fishData.catch.luckyStreak;
		}

		fishData.readyTimestamp = sb.Date.now() + successfulFishDelay; // 30 minutes

		let sizeString = "";
		if (caughtFishData.size) {
			const size = sb.Utils.random(1, 100);
			sizeString = `It is ${size} cm in length.`;

			if (size > fishData.lifetime.maxFishSize) {
				sizeString += " This is a new record!";
				fishData.lifetime.maxFishSize = size;
				fishData.lifetime.maxFishType = fishType;
			}
		}

		await context.user.setDataProperty("fishData", fishData);

		const gptLimitResult = await checkLimits(context.user);
		const gptRoll = sb.Utils.random(1, 3);

		if (!context.params.skipStory && sb.Command.get("gpt") && gptRoll === 1 && gptLimitResult.success) {
			const gptCommand = sb.Command.get("gpt");
			const prompt = createGptPrompt(context.user.Name, fishType, sizeString);
			const fauxContext = sb.Command.createFakeContext(gptCommand, {
				user: context.user,
				channel: context.channel,
				platform: context.platform,
				params: {
					temperature: 1
				}
			});

			try {
				const result = await sb.Command.get("gpt").execute(fauxContext, prompt);
				const fixedResult = result.reply.replace("🤖", "");

				return {
					reply: `✨${fishType}✨ ${fixedResult} (30m cooldown${appendix})`
				};
			}
			catch (e) {
				await sb.Logger.logError("Command", e, {
					origin: "External",
					context: {
						cause: "GPT within $fish"
					}
				});
			}
		}

		const emote = await getEmote(context, "success");
		return {
			reply: sb.Utils.tag.trim `
				You caught a ✨${fishType}✨
				${sizeString}
				${emote}
				Now, go do something productive!
				(30 minute fishing cooldown after a successful catch)
			`
		};
	}
};
