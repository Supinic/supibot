import { randomInt } from "../../utils/command-utils.js";
import type { Emote } from "../../utils/globals.js";

type Pattern = {
	name: string;
	description: string;
	execute: (emotes: Emote[], ...args: string[]) =>
		| { success: true; list: string[] }
		| { success: true; roll: [string, string, string], rolledItems: number }
		| { success: false; reply: string; };
};

export const slotCommandPatterns: Pattern[] = [
	{
		name: "gachi",
		description: "Selects all gachimuchi-related emotes.",
		execute: (emotes) => {
			const regex = /^[gG]achi/;
			return {
				success: true,
				list: emotes.filter(i => regex.test(i.name)).map(i => i.name)
			};
		}
	},
	{
		name: "twitch",
		description: "All Twitch global emotes.",
		execute: (emotes) => ({
			success: true,
			list: emotes.filter(i => i.type === "twitch-global").map(i => i.name)
		})
	},
	{
		name: "sub",
		description: "Rolls random emotes from Supibot's current subscriber emote list.",
		execute: (emotes) => ({
			success: true,
			list: emotes.filter(i => i.type === "twitch-subscriber").map(i => i.name)
		})
	},
	{
		name: "bttv",
		description: "Rolls from BTTV emotes in the current channel.",
		execute: (emotes) => ({
			success: true,
			list: emotes.filter(i => i.type === "bttv").map(i => i.name)
		})
	},
	{
		name: "ffz",
		description: "Rolls from FFZ emotes in the current channel.",
		execute: (emotes) => ({
			success: true,
			list: emotes.filter(i => i.type === "ffz").map(i => i.name)
		})
	},
	{
		name: "7tv",
		description: "Rolls from 7TV emotes in the current channel.",
		execute: (emotes) => ({
			success: true,
			list: emotes.filter(i => i.type === "7tv").map(i => i.name)
		})
	},
	{
		name: "numbers",
		description: "Rolls 3 numbers, from 1 to the given maximum. Must not exceed the maximum integer value, which is 9007199254740991.",
		execute: (emotes, ...args) => {
			const target = Number(args[0]);
			if (!core.Utils.isValidInteger(target)) {
				return {
					success: false,
					reply: "You must provide a proper number to roll the number slots!"
				};
			}
			else if (target > Number.MAX_SAFE_INTEGER) {
				return {
					success: false,
					reply: `The number must be an integer in the <2..${Number.MAX_SAFE_INTEGER}> range!`
				};
			}

			const roll1 = String(randomInt(1, target));
			const roll2 = String(randomInt(1, target));
			const roll3 = String(randomInt(1, target));
			return {
				success: true,
				roll: [roll1, roll2, roll3],
				rolledItems: target
			};
		}
	}
];
