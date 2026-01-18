import * as z from "zod";
import { declare } from "../../classes/command.js";
import rawTemplates from "./templates.json" with { type: "json" };

const templatesSchema = z.object({
	headlines: z.array(z.string()),
	parts: z.object({
		action: z.array(z.string()),
		adjA: z.array(z.string()),
		adjB: z.array(z.string()),
		clickbait: z.array(z.string()),
		groupA: z.array(z.string()),
		groupB: z.array(z.string()),
		guilty: z.array(z.string()),
		media: z.array(z.string()),
		peopleA: z.array(z.string()),
		peopleB: z.array(z.string()),
		status: z.array(z.string())
	})
});
const templates = templatesSchema.parse(rawTemplates);

const { headlines, parts } = templates;
const isPart = (input: string): input is keyof typeof parts => (Object.keys(parts).includes(input));

const REPEATS = 5;
const MAXIMUM_REPLACEMENTS = 10;
const headlinesRepeatArray: string[] = [];

export default declare({
	Name: "fakenews",
	Aliases: null,
	Cooldown: 10000,
	Description: "Randomly creates fake news headlines from existing presets. These are not real, and are supposed to be light-hearted and just a joke. Don't take them seriously.",
	Flags: ["mention","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: function fakeNews () {
		const eligibleHeadlines = headlines.filter(i => !headlinesRepeatArray.includes(i));

		let headline = core.Utils.randArray(eligibleHeadlines);
		headlinesRepeatArray.push(headline);
		headlinesRepeatArray.splice(REPEATS);

		// Prevents infinite while-looping in case of some unexpected string construct
		let fallback = MAXIMUM_REPLACEMENTS;
		while (headline.includes("[") && fallback-- >= 0) {
			headline = headline.replaceAll(/\[(\w+)]/g, (total, type: string) => (isPart(type))
				? core.Utils.randArray(parts[type])
				: type
			);
		}

		return {
			success: true,
			reply: headline
		};
	},
	Dynamic_Description: null
});
