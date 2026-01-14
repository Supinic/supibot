import { SupiDate } from "supi-core";
import { randomInt } from "../../../utils/command-utils.js";
import { addFish, addJunk, getInitialStats, rollCatch, saveData } from "./fishing-utils.js";

const FISHING_TRIP_STATIC_DURATION = 36e5; // 1 hour
const FISH_SUCCESS_DELAY_MIN = 30;

const execute = async (context, operation) => {
	let whisperOnFailure = false;
	if (context.channel) {
		const fishConfig = await context.channel.getDataProperty("fishConfig") ?? {};
		whisperOnFailure = Boolean(fishConfig.whisperOnFailure);
	}

	/** @type {UserFishData} */
	const fishData = await context.user.getDataProperty("fishData") ?? getInitialStats();
	if (!fishData.trap) {
		const { trap, lifetime } = getInitialStats();
		fishData.trap ??= trap;
		fishData.lifetime.trap ??= lifetime.trap;
	}

	const now = SupiDate.now();
	const { lifetime, trap } = fishData;
	if (fishData.readyTimestamp !== 0 && now < fishData.readyTimestamp) {
		return {
			replyWithPrivateMessage: whisperOnFailure,
			success: false,
			reply: `Hol' up partner! You can go set up your fishing traps ${core.Utils.timeDelta(fishData.readyTimestamp)}!`
		};
	}

	if (operation === "reset") {
		if (!trap.active) { // If not active, run the entire command again → will set up traps.
			return await execute(context);
		}
		else if (now < trap.end) { // If not ready, run the entire command again → will error out with proper timing.
			return await execute(context);
		}

		const trapsRetrieveResult = await execute(context);
		if (trapsRetrieveResult.success === false) {
			return trapsRetrieveResult;
		}

		const trapsSetupResult = await execute(context);
		if (trapsSetupResult.success === false) {
			return trapsSetupResult;
		}

		return {
			reply: `${trapsRetrieveResult.reply} ${trapsSetupResult.reply}`
		};
	}
	else if (operation === "cancel") {
		if (trap.active) {
			trap.active = false;
			trap.start = 0;
			trap.end = 0;
			lifetime.trap.cancelled++;

			await saveData(context, fishData);

			return {
				reply: `You have successfully retrieved your traps before they filled up. You don't get any junk or fish.`
			};
		}
		else {
			return {
				replyWithPrivateMessage: whisperOnFailure,
				success: false,
				reply: `You cannot cancel your fishing traps as you don't have them set up!`
			};
		}
	}

	if (!trap.active) { // Set up trap
		trap.active = true;
		trap.start = now;
		trap.end = now + FISHING_TRIP_STATIC_DURATION;
		trap.duration = FISHING_TRIP_STATIC_DURATION;

		await saveData(context, fishData);

		const end = core.Utils.timeDelta(trap.end, true);
		const emote = await context.getBestAvailableEmote(["PauseChamp"], "⌛");
		return {
			reply: `You have laid your fishing traps. Now we wait... ${emote} You can check them in about ${end}.`
		};
	}
	else if (now > trap.end) {
		const randomEfficiencyPercentage = randomInt(75, 90) / 100;
		const rolls = Math.floor(trap.duration / 60e3 * randomEfficiencyPercentage);

		let fishAmount = 0;
		const results = [];
		for (let i = 0; i < rolls; i++) {
			const item = rollCatch();
			if (!item.catch) {
				continue;
			}

			if (item.type === "fish" && i < (rolls - FISH_SUCCESS_DELAY_MIN)) { // Still "eligible" to catch a fish
				fishAmount++;
				i += FISH_SUCCESS_DELAY_MIN; // "Lose" equivalent of 30 minutes fishing time

				addFish(fishData, item.catch.name);
				results.push(item.catch.name);
			}
			else if (item.type === "junk") {
				addJunk(fishData, item.catch.name);
				results.push(item.catch.name);
			}
		}

		lifetime.trap.times++;
		lifetime.trap.timeSpent += trap.duration;
		trap.active = false;
		trap.start = 0;
		trap.end = 0;
		trap.duration = 0;

		if (fishAmount > lifetime.trap.bestFishCatch) {
			lifetime.trap.bestFishCatch = fishAmount;
		}

		await saveData(context, fishData);

		if (results.length === 0) {
			return {
				reply: `You drag the traps out of the water... and find that there is nothing at all...!`
			};
		}
		else if (fishAmount === 0) {
			return {
				reply: `You drag the traps out of the water... and find a bunch of junk. ${results.join("")}`
			};
		}
		else {
			return {
				reply: `You drag the traps out of the water... and you spot some fish! ${results.join("")}`
			};
		}
	}
	else {
		const delta = core.Utils.timeDelta(trap.end);
		return {
			replyWithPrivateMessage: whisperOnFailure,
			success: false,
			reply: core.Utils.tag.trim `
				Your traps are not fully loaded yet! They will be ready to harvest ${delta}.
				If you wish to get rid of them immediately, use "$fish trap cancel",
				but you will not get any catch from your traps.
			`
		};
	}
};

export default {
	name: "trap",
	aliases: ["net", "trawl"],
	description: [
		`<code>$fish trap</code>`,
		"Lay down a bunch of fishing traps to catch fish for you.",
		"You can then come back after 1 hour to see what you got waiting for you!",
		"Beware! You cannot go regular fishing while your traps are set! You would be disturbing the catch.",
		"",

		`<code>$fish trap cancel</code>`,
		"If you have set up your fishing traps and don't want to continue, you can reel them back in with this command.",
		"Be warned though, you won't get any catch by removing them early!",
		"",

		`<code>$fish trap reset</code>`,
		"If your traps are set up and ready to be fetched, this will retrieve them and immediately put them back.",
		"This is a QoL feature as it saves you one more command usage!"
	],
	execute
};
