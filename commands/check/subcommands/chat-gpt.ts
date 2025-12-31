import { SupiDate } from "supi-core";

import type { CheckSubcommandDefinition } from "../index.js";
import { postToHastebin } from "../../../utils/command-utils.js";
import GptCache from "../../gpt/cache-control.js";

export default {
	name: "chatgpt",
	title: "ChatGPT token usage",
	aliases: ["chat-gpt", "gpt"],
	default: false,
	description: ["Posts either: how many tokens you (or someone else) have used recently in the $gpt command; if used with \"total\", shows your total token amount overall."],
	execute: async (context, target) => {
		if (target === "total") {
			const total = await core.Query.getRecordset<number | undefined>(rs => rs
				.select("(SUM(Input_Tokens) + SUM(Output_Tokens)) AS Total")
				.from("data", "ChatGPT_Log")
				.where("User_Alias = %n", context.user.ID)
				.flat("Total")
				.single()
			);

			if (!total) {
				return {
					reply: `You have not used any ChatGPT tokens since April 2023.`
				};
			}
			else {
				const formatted = core.Utils.groupDigits(total);
				return {
					reply: `You have used ${formatted} ChatGPT tokens since April 2023.`
				};
			}
		}

		const targetUser = (target) ? await sb.User.get(target) : context.user;
		if (!targetUser) {
			return {
				success: false,
				reply: `Provided user does not exist!`
			};
		}

		const usage = await GptCache.getTokenUsage(targetUser);
		const limits = await GptCache.determineUserLimits(targetUser);

		const tokenUsage: Record<string, number> = {};
		for (const [timestamp, tokens] of Object.entries(usage.summary)) {
			const pretty = new SupiDate(Number(timestamp));
			tokenUsage[pretty.toUTCString()] = tokens;
		}

		const pronoun = (targetUser === context.user) ? "You" : "They";
		if (usage.dailyTokens <= 0) {
			return {
				reply: `${pronoun} have not used any GPT tokens in the past 24 hours.`
			};
		}

		const paste = await postToHastebin(JSON.stringify(tokenUsage, null, 4), {
			title: `${targetUser.Name}'s usage of Supibot $gpt command`
		});

		const dailyDigitString = core.Utils.groupDigits(core.Utils.round(usage.dailyTokens, 2));
		const dailyTokenString = (usage.dailyTokens !== usage.hourlyTokens)
			? `and ${dailyDigitString}/${limits.daily} tokens in the last 24 hours`
			: "";

		const hastebinLinkString = (paste.ok) ? `- full usage details: ${paste.link}` : "";
		return {
			reply: core.Utils.tag.trim `
				${pronoun} have used up
				${core.Utils.round(usage.hourlyTokens, 2)}/${limits.hourly} tokens in the last hour
				${dailyTokenString}
				${hastebinLinkString}
			`
		};
	}
} satisfies CheckSubcommandDefinition;
