const BASE_GPT_QUERY = sb.Utils.tag.trim `
	This is the FAQ documentation for a chat bot Supibot. 
	Its commands are prefixed with "$".
	You will now assist me by answering my query with the appropriate FAQ item, formatted as needed.
	If there are no FAQ items applicable, reply with "This is not applicable to Supibot FAQ!".
	FAQ: 
`;

module.exports = {
	Name: "faq",
	Aliases: [],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts the link to Supibot's FAQ on the supinic.com website.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function faq (context, ...args) {
		if (args.length === 0) {
			return {
				reply: sb.Utils.tag.trim `
					Check the FAQ here: https://supinic.com/data/faq/list
				    If you didn't find an answer, make a suggestion with the $suggest command.
				`
			};
		}

		const faqData = await sb.Query.getRecordset(rs => rs
			.select("Question", "Answer")
			.from("data", "FAQ")
		);

		const result = [];
		for (const item of faqData) {
			result.push(`Q: ${sb.Utils.removeHTML(item.Question)} -- A: ${sb.Utils.removeHTML(item.Answer)}`);
		}

		const response = await sb.Got("GenericAPI", {
			method: "POST",
			throwHttpErrors: false,
			responseType: "text",
			url: "https://nexra.aryahcr.cc/api/chat/gpt",
			json: {
				messages: [
					{ role: "user", content: `${BASE_GPT_QUERY}${result.join("\n")}` }
				],
				model: "gpt-4-32k",
				prompt: args.join(" "),
				markdown: false,
				top_p: 1,
				frequency_penalty: 0,
				presence_penalty: 0
			}
		});

		const index = response.body.indexOf("{");
		if (index === -1) {
			return {
				success: false,
				reply: `Nexra API returned an invalid response! Try again later.`
			};
		}

		try {
			response.body = JSON.parse(response.body.slice(index));
		}
		catch (e) {
			return {
				success: false,
				reply: `Nexra API returned an invalid response! Try again later.`
			};
		}

		return {
			reply: `ℹ ${response.body.gpt}`
		};
	}),
	Dynamic_Description: null
};
