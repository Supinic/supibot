module.exports = {
	Name: "randomemoji",
	Aliases: ["re"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Fetches a random emoji. If a number is provided, rolls that many emojis.",
	Flags: ["pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		limit: 10
	})),
	Code: (async function randomEmoji (context, number = 1) {
		const repeats = Number(number);
		if (!repeats || repeats > this.staticData.limit || repeats < 1 || Math.trunc(repeats) !== repeats) {
			return {
				success: false,
				reply: "Invalid or too high amount of emojis!"
			};
		}

		const emojis = sb.Config.get("EMOJI_LIST");
		return {
			reply: [...new Array(repeats)].map(() => sb.Utils.randArray(emojis)).join(" ")
		};
	}),
	Dynamic_Description: (async (prefix, values) => {
		const { limit } = values.getStaticData();
		const list = sb.Config.get("EMOJI_LIST");
	
		return [
			`Returns a random word from a list of ${list.length} pre-determined emojis.`,
			`Maximum amount of words: ${limit}`,
			"",
			
			`<code>${prefix}re</code>`,
			"(one random emoji)",
			"",
	
			`<code>${prefix}re 10</code>`,
			"(ten random emojis)",
			"",
	
			`Emoji list: <br>${list.join(" ")}`
		];
	})
};
