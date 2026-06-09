import { slotCommandPatterns } from "./definitions.js";
import { declare } from "../../classes/command.js";
const leaderboardKeywords = ["leader", "leaders", "leaderboard", "winners"];

const ROLLED_ITEMS = 3;
let logTableExists: boolean | undefined;

export default declare({
	Name: "slots",
	Aliases: null,
	Cooldown: 5000,
	Description: "Once at least three unique emotes (or words) have been provided, rolls a pseudo slot machine to see if you get a flush.",
	Flags: ["mention", "pipe"],
	Params: [
		{ name: "pattern", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function slots (context, ...args) {
		if (args.length === 0 && !context.params.pattern) {
			return {
				success: false,
				reply: "No input provided! You should use a couple of words to roll or use one of existing patterns."
			};
		}
		else if (leaderboardKeywords.includes(args[0])) {
			return {
				reply: "Check out all the previous slots winners here: https://supinic.com/data/slots-winner/leaderboard",
				cooldown: 5000
			};
		}
		else if (!context.channel) {
			return {
				success: false,
				reply: `This command cannot be used in private messages!`
			};
		}

		let rolledItems: string[];
		let itemAmount: number;
		let resultList: string | undefined;

		if (context.params.pattern) {
			const pattern = slotCommandPatterns.find(i => i.name === context.params.pattern);
			if (!pattern) {
				return {
					success: false,
					reply: `Provided slots preset does not exist!`
				};
			}

			const emotes = await context.channel.fetchEmotes();
			const result = pattern.execute(emotes, ...args);
			if (!result.success) {
				return result;
			}

			if ("list" in result) {
				rolledItems = [];
				itemAmount = result.list.length;
				resultList = result.list.join(" ");
				for (let i = 0; i < ROLLED_ITEMS; i++) {
					rolledItems.push(core.Utils.randArray(result.list));
				}
			}
			else {
				rolledItems = result.roll;
				itemAmount = result.rolledItems;
			}
		}
		else {
			const uniqueItems = new Set(args);
			if (uniqueItems.size !== args.length) {
				return {
					success: false,
					reply: "Your list of words must not have any repeats!"
				};
			}

			rolledItems = [];
			itemAmount = args.length;
			resultList = args.join(" ");

			for (let i = 0; i < ROLLED_ITEMS; i++) {
				rolledItems.push(core.Utils.randArray(args));
			}
		}

		const uniqueRolls = new Set(rolledItems);
		if (uniqueRolls.size !== 1) {
			return {
				success: true,
				reply: `[ ${rolledItems.join(" ")} ]`
			};
		}
		else if (itemAmount === 1) {
			const dankEmote = await context.getBestAvailableEmote(["FeelsDankMan", "FeelsDonkMan"], "🤡");
			return {
				success: true,
				reply: `[ ${rolledItems.join(" ")} ] ${dankEmote} You won and beat the odds of 100%.`
			};
		}

		const odds = (1 / itemAmount) ** (ROLLED_ITEMS - 1);
		const oneInChance = core.Utils.round((1 / odds), 3);

		logTableExists ??= await core.Query.isTablePresent("data", "Slots_Winner");
		if (logTableExists) {
			const row = await core.Query.getRow("data", "Slots_Winner");
			row.setValues({
				User_Alias: context.user.ID,
				Source: (resultList) ?? `Number roll: 1 to ${itemAmount}`,
				Result: rolledItems.join(" "),
				Channel: context.channel.ID,
				Odds: oneInChance
			});

			await row.save({ skipLoad: true });
		}

		// Discard the row save result - not needed anywhere
		const pogEmote = await context.getBestAvailableEmote(["PagChomp", "Pog", "PogChamp"], "🎉");
		return {
			success: true,
			reply: core.Utils.tag.trim `
				[ ${rolledItems.join(" ")} ] 
				${pogEmote} A flush! 
				Congratulations, you beat the odds of 
				${core.Utils.round(odds * 100, 3)}%
				(that is 1 in ${oneInChance})
			`
		};
	}),
	Dynamic_Description: (prefix) => {
		const patternList = slotCommandPatterns
			.toSorted((a, b) => a.name.localeCompare(b.name))
			.map(i => `<li><code>${i.name}</code><br>${i.description}</li>`)
			.join("");

		return [
			"Rolls three random words out of the given list of words. If you get a flush, you win!",
			`Every winner is listed in <a href="https://supinic.com/data/slots-winner/leaderboard">this neat table</a>.`,
			"",

			`<code>${prefix}slots (list of words)</code>`,
			"Three rolls will be chose randomly. Get the same one three times for a win.",
			"",

			`<code>${prefix}slots pattern:(pattern name)</code>`,
			"Uses a pre-determined or dynamic pattern as your list of words. See below.",
			"",

			"Supported patterns:",
			`<ul>${patternList}</ul>`,

			...leaderboardKeywords.map(i => `<code>${prefix}slots ${i}</code>`),
			"Posts a link to the slots winners leaderboard, sorted by the odds of winning.",
			`You can also check it out here: <a href="/data/slots-winner/leaderboard">Slots winners list</a>`
		];
	}
});
