module.exports = {
	Name: "kanji",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts a quick summary of a given Kanji(?) character",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function kanji (context, character) {
		if (!character) {
			return {
				success: false,
				reply: "Pepega"
			};
		}

		const response = await sb.Got("GenericAPI", {
			prefixUrl: "https://app.kanjialive.com/api",
			url: `kanji/${encodeURIComponent(character)}`
		});

		const data = response.body;
		if (data.Error) {
			return {
				success: false,
				reply: `Error: ${data.Error}`
			};
		}

		return {
			reply: `${data.ka_utf} (${data.kunyomi}; ${data.onyomi}): ${data.meaning}.`
		};
	}),
	Dynamic_Description: null
};
