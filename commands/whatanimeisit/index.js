module.exports = {
	Name: "whatanimeisit",
	Aliases: ["tracemoe","wait"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "What anime is it? For a given screenshot of an anime show, this command will attempt to recognize the show's name, episode and timestamp.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function whatAnimeIsIt (context, link) {
		if (!link) {
			return {
				success: false,
				reply: `No link provided!`
			};
		}

		const { statusCode, body: data } = await sb.Got({
			url: "https://trace.moe/api/search",
			searchParams: {
				url: link
			},
			responseType: "json",
			throwHttpErrors: false
		});

		if (statusCode !== 200) {
			const filtered = data.replace(link, "");
			return {
				success: false,
				reply: `${filtered}!`
			};
		}

		const { docs } = data;
		if (docs.length === 0) {
			return {
				success: false,
				reply: "No matching show found for this picture!"
			};
		}

		const [show] = docs;
		const name = show.title_english ?? show.title_romaji ?? show.title_native;
		const time = sb.Utils.formatTime(Math.trunc(show.at), true);
		const similarity = sb.Utils.round(show.similarity * 100, 2);

		const descriptor = [];
		if (show.season) {
			descriptor.push("S" + sb.Utils.zf(show.season, 2));
		}
		if (show.episode) {
			descriptor.push("E" + sb.Utils.zf(show.episode, 2));
		}

		return {
			reply: sb.Utils.tag.trim `
				Best match for your picture:
				${name}, 
				${descriptor.join("")},
				around ${time}.
				Similarity score: ${similarity}% 
			`
		};
	}),
	Dynamic_Description: null
};