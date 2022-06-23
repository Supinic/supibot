module.exports = {
	Name: "query",
	Aliases: null,
	Author: "supinic",
	Cooldown: 60000,
	Description: "Wolfram Alpha query",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function query (context, ...args) {
		if (args.length === 0) {
			return {
				reply: "No query provided!",
				cooldown: { length: 2500 }
			};
		}

		const rawData = await sb.Got({
			throwHttpErrors: false,
			url: "http://api.wolframalpha.com/v1/result",
			searchParams: {
				appid: sb.Config.get("API_WOLFRAM_ALPHA_APPID"),
				i: args.join(" ")
			}
		}).text();

		const data = sb.Config.get("WOLFRAM_QUERY_CENSOR_FN")(rawData);
		return {
			reply: (context.platform.Name === "discord")
				? `\`${data}\``
				: data
		};
	}),
	Dynamic_Description: null
};
