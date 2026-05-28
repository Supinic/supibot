import { SupiDate } from "supi-core";
import type { StatsSubcommandDefinition } from "../index.js";
type Data = { requests: number; inputTokens: number; outputTokens: number; };

let tableExists: boolean | undefined;

export default {
	name: "gpt",
	aliases: [],
	title: "ChatGPT usage",
	description: [],
	getDescription: (prefix) => [
		`<code>${prefix}stats gpt</code>`,
		`Checks how many queries and tokens have been used in the <a href="/bot/command/detail/gpt">$gpt command</a> this month.`
	],
	execute: async () => {
		tableExists ??= await core.Query.isTablePresent("data", "ChatGPT_Log");
		if (!tableExists) {
			return {
				success: false,
				reply: "The logging table for ChatGPT is not present in database!"
			};
		}

		const { month, year } = new SupiDate();
		const tokenResponse = await core.Query.getRecordset<Data>(rs => rs
			.select("COUNT(*) AS requests", "SUM(Input_Tokens) AS inputTokens", "SUM(Output_Tokens) AS outputTokens")
			.from("data", "ChatGPT_Log")
			.where("YEAR(Executed) = %n AND MONTH(Executed) = %n", year, month)
			.single()
		);

		const { requests, inputTokens, outputTokens } = tokenResponse;
		const prettyMonthName = new SupiDate().format("F Y");
		return {
			reply: core.Utils.tag.trim `
				There have been ${core.Utils.groupDigits(requests)} 
				ChatGPT requests in ${prettyMonthName} so far. 
				${core.Utils.groupDigits(inputTokens)} input
				and ${core.Utils.groupDigits(outputTokens)} output tokens
				have been processed.
			`
		};
	}
} satisfies StatsSubcommandDefinition;
