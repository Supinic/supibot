export default {
	name: "gpt",
	aliases: [],
	description: "Checks how many queries, and how many tokens have been used in $gpt this month.",
	execute: async () => {
		const { month, year } = new sb.Date();
		const tokenResponse = await core.Query.getRecordset(rs => rs
			.select("COUNT(*) AS Count", "SUM(Input_Tokens) AS Input", "SUM(Output_Tokens) AS Output")
			.from("data", "ChatGPT_Log")
			.where("YEAR(Executed) = %n AND MONTH(Executed) = %n", year, month)
			.single()
		);

		const requests = tokenResponse.Count;
		const inputTokens = tokenResponse.Input;
		const outputTokens = tokenResponse.Output;

		const prettyMonthName = new sb.Date().format("F Y");
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
};
