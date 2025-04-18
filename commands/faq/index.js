export default {
	Name: "faq",
	Aliases: [],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts the link to Supibot's FAQ on the supinic.com website.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function faq (context, ...args) {
		if (args.length > 0) {
			const query = args.join(" ");
			for (const column of ["Question", "Answer"]) {
				const data = await core.Query.getRecordset(rs => rs
					.select("Question", "Answer")
					.from("data", "FAQ")
					.where(`${column} %*like*`, query)
				);

				if (data.length === 1) {
					const row = data[0];
					const answer = core.Utils.removeHTML(row.Answer);
					const question = core.Utils.removeHTML(row.Question);

					return {
						reply: `Q: ${question} A: ${answer}`
					};
				}
			}
		}

		return {
			reply: core.Utils.tag.trim `
				Check the FAQ here: https://supinic.com/data/faq/list
			 	If you didn't find an answer, make a suggestion with the $suggest command.
			`
		};
	}),
	Dynamic_Description: null
};
