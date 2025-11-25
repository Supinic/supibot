import { randomInt } from "../../../utils/command-utils.js";
import {
	baitTypes,
	COIN_EMOJI,
	getCatchMessage,
	getEmote,
	getInitialStats,
	getWeightedCatch
} from "./fishing-utils.js";

import { checkLimits } from "../../gpt/cache-control.js";

const gptStyles = ["exciting", "spooky", "smug", "radical", "mysterious", "hilarious", "enchanting", "touching", "intriguing"];
const createGptPrompt = (executor, resultFish, sizeString) => core.Utils.tag.trim `
	Write a short, ${core.Utils.randArray(gptStyles)} fishing story
	about a user named "${executor}"
	who catches a ${resultFish} in the water and keeps it!
	${sizeString}
	Make it very concise - a maximum of 150 characters.
`;

const formatDelay = (delay) => core.Utils.timeDelta(sb.Date.now() + delay, true);

const useDiscordReactions = (context, config, resultType) => {
	if (context.platform.Name !== "discord") {
		return false;
	}
	else if (config === "none") {
		return false;
	}

	if (resultType === "fail" && (config === "all" || config === "fail-only")) {
		return true;
	}
	else if (resultType === "catch" && config === "all") {
		return true;
	}

	return false;
};

const successfulFishDelay = 18e5; // 18e5 - 30 min
const unsuccessfulFishDelay = [30_000, 90_000];
const baitDisplay = baitTypes.map(i => `<code>${i.name}</code> ${i.emoji} (${i.price} coins, 1/${i.roll})`).join(" - ");

export default {
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
		let whisperOnFailure = false;
		let discordReactionType = "none";
		if (context.channel) {
			const fishConfig = await context.channel.getDataProperty("fishConfig") ?? {};
			whisperOnFailure = Boolean(fishConfig.whisperOnFailure);
			discordReactionType = fishConfig.discordReactionType ?? "none";
		}

		/** @type {UserFishData} */
		const fishData = await context.user.getDataProperty("fishData") ?? getInitialStats();
		if (fishData.readyTimestamp !== 0 && sb.Date.now() < fishData.readyTimestamp) {
			if (useDiscordReactions(context, discordReactionType, "fail")) {
				return {
					success: false,
					discord: {
						reactions: ["⏱"]
					}
				};
			}

			return {
				success: false,
				replyWithPrivateMessage: whisperOnFailure,
				reply: `Hol' up partner! You can go fishing again ${core.Utils.timeDelta(fishData.readyTimestamp)}!`
			};
		}

		if (fishData.trap?.active === true) {
			const now = sb.Date.now();
			if (now > fishData.trap.end) {
				return {
					success: false,
					replyWithPrivateMessage: whisperOnFailure,
					reply: core.Utils.tag.trim `
						You cannot go fishing while your traps are laid out - you would be disturbing the catch!
						Your traps are ready to be collected! Go ahead and use "$fish trap" to get your stuff.
					`
				};
			}
			else {
				return {
					success: false,
					replyWithPrivateMessage: whisperOnFailure,
					reply: core.Utils.tag.trim `
						You cannot go fishing while your traps are laid out - you would be disturbing the catch!
						If you wish to get rid of the traps immediately, use "$fish trap cancel",
						but you will not get any catch from them.
					`
				};
			}
		}

		let rollMaximum = 20;
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

		const roll = randomInt(1, rollMaximum);
		if (roll !== 1) {
			const fishingDelay = core.Utils.round(randomInt(...unsuccessfulFishDelay), -3);

			fishData.catch.dryStreak++;
			fishData.catch.luckyStreak = 0;
			fishData.readyTimestamp = sb.Date.now() + fishingDelay + 1000;

			if (fishData.catch.dryStreak > fishData.lifetime.dryStreak) {
				fishData.lifetime.dryStreak = fishData.catch.dryStreak;
			}

			let message;
			const reactions = ["🚫"];
			const junkRoll = randomInt(1, 100);
			if (junkRoll <= 25) {
				const item = getWeightedCatch("junk");
				reactions.push(item.name);

				fishData.catch.junk = (fishData.catch.junk ?? 0) + 1;
				fishData.lifetime.junk = (fishData.lifetime.junk ?? 0) + 1;
				fishData.catch.types[item.name] = (fishData.catch.types[item.name] ?? 0) + 1;

				message = `${getCatchMessage("junk")} You reel out a ${item.name}`;
			}
			else {
				const missDistance = randomInt(1, 500);
				message = `Your fishing line landed ${missDistance} cm away.`;
			}

			await context.user.setDataProperty("fishData", fishData);

			if (useDiscordReactions(context, discordReactionType, "fail")) {
				return {
					discord: { reactions }
				};
			}

			let streakString = "";
			const { dryStreak } = fishData.catch;
			if (dryStreak >= 3) {
				const sinceString = (fishData.lifetime.fish === 0) ? "you started fishing" : "your last catch";
				streakString = ` This is your attempt #${dryStreak} since ${sinceString}.`;
			}

			const emote = await getEmote(context, "failure");
			return {
				replyWithPrivateMessage: whisperOnFailure,
				reply: core.Utils.tag.trim `
					No luck... ${emote}
					${message}
					(${formatDelay(fishingDelay)} cooldown${appendix})
					${streakString}
				`
			};
		}

		const caughtFishData = getWeightedCatch("fish");
		const fishType = caughtFishData.name;

		fishData.catch.fish = (fishData.catch.fish ?? 0) + 1;
		fishData.catch.types[fishType] = (fishData.catch.types[fishType] ?? 0) + 1;
		fishData.lifetime.fish++;

		fishData.catch.dryStreak = 0;
		fishData.catch.luckyStreak++;
		if (fishData.catch.luckyStreak > fishData.lifetime.luckyStreak) {
			fishData.lifetime.luckyStreak = fishData.catch.luckyStreak;
		}

		fishData.readyTimestamp = sb.Date.now() + successfulFishDelay; // 30 minutes

		let sizeString = "";
		if (caughtFishData.size) {
			const size = randomInt(1, 100);
			sizeString = `It is ${size} cm in length.`;

			if (size > fishData.lifetime.maxFishSize) {
				sizeString += " This is a new record!";
				fishData.lifetime.maxFishSize = size;
				fishData.lifetime.maxFishType = fishType;
			}
		}

		await context.user.setDataProperty("fishData", fishData);

		if (useDiscordReactions(context, discordReactionType, "success")) {
			return {
				discord: {
					reactions: ["🎉", fishType]
				}
			};
		}

		const gptLimitResult = await checkLimits(context.user);
		const gptRoll = randomInt(1, 3);

		if (!context.params.skipStory && sb.Command.get("gpt") && gptRoll === 1 && gptLimitResult.success) {
			const gptCommand = sb.Command.get("gpt");
			const prompt = createGptPrompt(context.user.Name, fishType, sizeString);
			const fauxContext = sb.Command.createFakeContext(gptCommand, {
				user: context.user,
				channel: context.channel,
				platform: context.platform,
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
			reply: core.Utils.tag.trim `
				You caught a ✨${fishType}✨
				${sizeString}
				${emote}
				Now, go do something productive!
				(30 minute fishing cooldown after a successful catch)
			`
		};
	}
};
