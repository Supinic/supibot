module.exports = {
	Name: "topemotestoday",
	Aliases: ["tet"],
	Author: "supinic",
	Cooldown: 20000,
	Description: "Posts the top 10 used emotes on Twitch for a given day.",
	Flags: ["mention","non-nullable"],
	Params: [
		{ name: "date", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		fixMissingCode: (baseEmoteSet, ID) => {
			const emote = baseEmoteSet.emotes.find(i => i.ID === ID);
			return emote?.token ?? null;
		}
	})),
	Code: (async function topEmotesToday (context) {
		const date = (context.params.date)
			? new sb.Date(context.params.date)
			: new sb.Date();

		if (!date) {
			return {
				success: false,
				reply: "Invalid date provided!"
			};
		}

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
				const count = sb.Utils.formatSI(i.count, "", 2);
				const code = this.staticData.fixMissingCode(globalEmotes, String(i.id))
					?? i.code
					?? "(unknown)";

				return `${ind + 1}): ${code} ${count}`;
			})
			.join("; ")

		return { reply };
	}),
	Dynamic_Description: null
};