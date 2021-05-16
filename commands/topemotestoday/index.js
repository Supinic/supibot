module.exports = {
	Name: "topemotestoday",
	Aliases: ["tet"],
	Author: "supinic",
	Cooldown: 20000,
	Description: "Posts the top 10 used emotes on Twitch for today, or a given day.",
	Flags: ["mention","non-nullable"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		fixMissingCode: (baseEmoteSet, ID) => {
			const emote = baseEmoteSet.emotes.find(i => i.ID === ID);
			return emote?.token ?? null;
		}
	})),
	Code: (async function topEmotesToday (context, ...args) {
		const date = (args.length > 0)
			? sb.Utils.parseChrono(args.join(" "))
			: new sb.Date();

		if (!date) {
			return {
				success: false,
				reply: `Could not parse your input!`
			};
		}

		date.setTimezoneOffset(0);
		const data = await sb.Got("GenericAPI", {
			url: "https://internal-api.twitchemotes.com/api/stats/top/by-date",
			searchParams: new sb.URLParams()
				.set("limit", "10")
				.set("date", date.format("Y-m-d"))
				.toString()
		}).json();

		if (data.length === 0) {
			return {
				success: false,
				reply: "That day has no top-emotes data available!"
			};
		}

		const globalEmotes = sb.Platform.get("twitch").controller.availableEmotes.find(i => i.ID === "0");
		const reply = data
			.sort((a, b) => b.count - a.count)
			.map((i, ind) => {
				const count = sb.Utils.groupDigits(i.count);
				const code = this.staticData.fixMissingCode(globalEmotes, String(i.id))
					?? i.code
					?? "(unknown)";

				return `${ind + 1}) ${code} ${count}`;
			})
			.join("; ")

		return { reply };
	}),
	Dynamic_Description: (async (prefix) => {
		return [
			"Fetches the top 10 Twitch emotes used today, or in a specific day, if provided correctly.",
			"",

			`<code>${prefix}tet</code>`,
			"Fetches the top list for today.",
			"",

			`<code>${prefix}tet today</code>`,
			`<code>${prefix}tet yesterday</code>`,
			`<code>${prefix}tet last week</code>`,
			`<code>${prefix}tet 2021-01-01</code>`,
			"Fetches the top list for the specified date. You can use natural language.",
			"If your date format doesn't work, try YYYY-MM-DD instead, that should be fine."
		];
	})
};