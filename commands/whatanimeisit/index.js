module.exports = {
	Name: "whatanimeisit",
	Aliases: ["tracemoe"],
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
				reply: `No link provided!`,
				cooldown: 2500
			};
		}

		// Possible future reference:
		// POST method with FormData (name: "image") is also possible if working with files
		const { statusCode, body: data } = await sb.Got({
			url: "https://api.trace.moe/search",
			searchParams: {
				url: link
			},
			responseType: "json",
			throwHttpErrors: false
		});

		if (statusCode !== 200) {
			const errorMessage = (data.error)
				? data.error.replace(link, "")
				: `Unknown error occured (status code ${statusCode})`;

			return {
				success: false,
				reply: `${errorMessage}!`
			};
		}

		const [result] = data.result.filter(i => i.from !== 0).sort((a, b) => b.similarity - a.similarity);
		if (!result) {
			return {
				success: false,
				reply: "No matching show found for this picture!"
			};
		}

		const showKey = { type: "show", id: result.anilist };
		let show = await this.getCacheData(showKey);
		if (!show) {
			const response = await sb.Got.gql({
				url: "https://trace.moe/anilist",
				query: `query ($ids: [Int]) {
					Page (page: 1, perPage: 1) {
						media (id_in: $ids, type: ANIME) {
							title {
								english
								romaji
								native
							}
							isAdult
						}
					}
				}`,
				variables: {
					ids: [result.anilist]
				}
			});

			[show] = response.body.data.Page.media;
			await this.setCacheData(showKey, show, { expiry: 30 * 864e5 }); // 30 days expiration
		}

		const name = show.title.english ?? show.title.romaji ?? show.title.native;

		const time = sb.Utils.formatTime(Math.trunc(result.from), true);
		const similarity = sb.Utils.round(result.similarity * 100, 2);

		const descriptor = [];
		if (result.season) {
			descriptor.push(`S${sb.Utils.zf(result.season, 2)}`);
		}
		if (result.episode) {
			descriptor.push(`E${sb.Utils.zf(result.episode, 2)}`);
		}

		const videoLinkKey = { type: "video-link", url: result.video };
		let videoLink = await this.getCacheData(videoLinkKey);
		if (!videoLink) {
			const videoData = await sb.Got({
				url: result.video,
				responseType: "buffer",
				throwHttpErrors: false
			});

			let uploadResult = await sb.Utils.uploadToNuuls(videoData.rawBody ?? videoData.body, "file.mp4");
			if (uploadResult.statusCode !== 200) {
				uploadResult = await sb.Utils.uploadToImgur(videoData.rawBody ?? videoData.body, "file.mp4");
			}

			if (uploadResult.link) {
				videoLink = uploadResult.link;
				await this.setCacheData(videoLinkKey, videoLink, { expiry: 30 * 864e5 }); // 30 days
			}
		}

		const adult = (show.isAdult) ? "(18+)" : "";
		if (show.isAdult && (context.channel && !context.channel.NSFW)) {
			videoLink = "(NSFW link omitted)";
		}

		return {
			reply: sb.Utils.tag.trim `
				Best match for your picture:
				${name.trim()} ${adult}
				${descriptor.join("")}
				-
				around ${time}.
				Similarity score: ${similarity}% 
				Video preview: ${videoLink ?? "(N/A)"}
			`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"For a provided screenshot or picture of an anime show, attempts to recognize the show's name, episode, timestamp and even a video preview (if possible).",
		"If the detected show is marked as NSFW (18+) and the command is NOT used in an NSFW channel or in private messages, the video preview will be omitted.",
		"",

		`<code>${prefix}whatanimeisit (link)</code>`,
		`<code>${prefix}tracemoe (link)</code>`,
		"If found, creates a little summary of the detected show."
	])
};
