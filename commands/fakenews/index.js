const REPEATS = 5;
const MAXIMUM_REPLACEMENTS = 10;
const headlinesRepeatArray = [];

module.exports = {
	Name: "fakenews",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Randomly creates fake news headlines from existing presets. These are not real, and are supposed to be light-hearted and just a joke. Don't take them seriously.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function fakeNews () {
		const { headlines, parts } = require("./templates.json");
		const eligibleHeadlines = headlines.filter(i => !headlinesRepeatArray.includes(i));

		let headline = sb.Utils.randArray(eligibleHeadlines);
		headlinesRepeatArray.push(headline);
		headlinesRepeatArray.splice(REPEATS);

		let fallback = MAXIMUM_REPLACEMENTS;
		while (headline.includes("[") && fallback-- >= 0) {
			headline = headline.replaceAll(/\[(\w+)]/g, (_total, type) => sb.Utils.randArray(parts[type]));
		}

		return {
			reply: headline
		};
	}),
	Dynamic_Description: null
};
