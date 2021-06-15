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
		if (args.length > 0) {
			for (const column of ["Question", "Answer"]) {
				const data = await sb.Query.getRecordset(rs => {
					rs.select("Question", "Answer");
					rs.from("data", "FAQ");

					for (const word of args) {
						rs.where(`LOWER(${column}) %*like*`, word.toLowerCase());
					}

					return rs;
				});

				if (data.length === 1) {
					const row = data[0];
					const answer = sb.Utils.removeHTML(row.Answer);
					const question = sb.Utils.removeHTML(row.Question);

					return {
						reply: `Q: ${question} A: ${answer}`
					};
				}
			}
		}

		return {
			reply: sb.Utils.tag.trim `
				FAQ list here: https://supinic.com/data/faq/list
				For discussions, check https://github.com/Supinic/supibot/discussions/
			 	or make a suggestion with the $suggest command.
			`
		};
	}),
	Dynamic_Description: null
};
