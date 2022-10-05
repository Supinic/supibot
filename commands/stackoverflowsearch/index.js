module.exports = {
	Name: "stackoverflowsearch",
	Aliases: ["stackoverflow","sos"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Searches SO for relevant questions and answers.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function stackOverflowSearch (context, ...args) {
		const message = args.join(" ");
		if (!message) {
			return { reply: "No search text provided!" };
		}

		const response = await sb.Got("GenericAPI", {
			url: "https://api.stackexchange.com/2.2/search/advanced",
			searchParams: {
				order: "desc",
				sort: "relevance",
				site: "stackoverflow",
				q: message
			}
		});

		const data = response.body;
		if (data.quota_remaining === 0) {
			return { reply: "Daily quota exceeded! :(" };
		}
		else if (data.items.length === 0) {
			return { reply: "No relevant questions found!" };
		}

		const item = data.items[0];
		return {
			reply: sb.Utils.tag.trim `
				${sb.Utils.fixHTML(item.title)},
				(score: ${item.score}, answers: ${item.answer_count})
				asked by ${item.owner.display_name}
				${sb.Utils.timeDelta(new sb.Date(item.creation_date * 1000))}
				and last active
				${sb.Utils.timeDelta(new sb.Date(item.last_activity_date * 1000))}.
				https://stackoverflow.com/questions/${item.question_id}
			`
		};
	}),
	Dynamic_Description: null
};
