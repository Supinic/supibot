import * as z from "zod";
import { declare } from "../../classes/command.js";

const searchSchema = z.object({
	error: z.string(),
	frameCount: z.int(),
	result: z.array(z.object({
		anilist: z.object({
			isAdult: z.boolean(),
			title: z.object({
				english: z.string().nullish(),
				romaji: z.string().nullish(),
				native: z.string()
			})
		}),
		from: z.float32(),
		to: z.float32(),
		at: z.float32(),
		duration: z.float32(),
		similarity: z.float32().min(0).max(1),
		episode: z.int().nullish(),
		season: z.int().nullish(),
		filename: z.string(),
		image: z.string(),
		video: z.string()
	}))
});

export default declare({
	Name: "whatanimeisit",
	Aliases: ["tracemoe"],
	Cooldown: 5000,
	Description: "What anime is it? For a given screenshot of an anime show, this command will attempt to recognize the show's name, episode and timestamp.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: async function whatAnimeIsIt (context, link) {
		if (!link) {
			return {
				success: false,
				reply: `No link provided! You should provide a screenshot link to be checked.`
			};
		}

		const response = await core.Got.get("GenericAPI")({
			url: "https://api.trace.moe/search",
			searchParams: {
				url: link,
				anilistInfo: "1"
			},
			responseType: "json",
			throwHttpErrors: false
		});

		if (!response.ok) {
			return {
				success: false,
				reply: `Could not check your image for results! Try again later (error code ${response.statusCode})`
			};
		}

		const { result } = searchSchema.parse(response.body);
		const show = result.sort((a, b) => b.similarity - a.similarity).find(i => i.from !== 0);
		if (!show) {
			return {
				success: false,
				reply: "No matching show found for this picture!"
			};
		}

		const { title, isAdult } = show.anilist;
		const name = title.english ?? title.romaji ?? title.native;
		const time = core.Utils.formatTime(Math.trunc(show.from), true);
		const similarity = core.Utils.round(show.similarity * 100, 2);

		const descriptor = [];
		if (show.season) {
			descriptor.push(`S${core.Utils.zf(show.season, 2)}`);
		}
		if (show.episode) {
			descriptor.push(`E${core.Utils.zf(show.episode, 2)}`);
		}

		let videoString = `Preview: ${show.video}`;
		if (isAdult && (context.channel && !context.channel.NSFW)) {
			videoString = "(NSFW link omitted)";
		}

		const adult = (isAdult) ? "(18+)" : "";
		return {
			reply: core.Utils.tag.trim `
				Best match for your picture:
				${name.trim()} ${adult}
				${descriptor.join("")}
				-
				around ${time}.
				Similarity score: ${similarity}% 
				${videoString}
			`
		};
	},
	Dynamic_Description: (prefix) => [
		"For an image/screenshot of an anime show, this command attempts to recognize the show's name, episode, timestamp and even a video preview, if one exists.",
		"If the detected show is marked as NSFW (18+) and the command is used in a SFW channel or in PMs, the video preview will be omitted (for obvious reasons).",
		`Powered by <a href="//trace.moe/">Trace.moe</a> API`,
		"",

		`<code>${prefix}whatanimeisit (link)</code>`,
		`<code>${prefix}tracemoe (link)</code>`,
		"If found, creates a little summary of the detected show."
	]
});
