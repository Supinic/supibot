module.exports = {
	Name: "pick",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Picks a single word from the provided list of words in a message.",
	Flags: ["mention","pipe","use-params"],
	Params: [
		{ name: "delimiter", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function pick (context, ...words) {
		if (words.length === 0) {
			return {
				reply: "No input provided!"
			};
		}

		const splitRegex = (context.params.delimiter)
			? new RegExp(context.params.delimiter)
			: /\s+/;

		// normalize input - there might be arguments with other or multiple whitespace inside them
		const prepared = words.join(" ").split(splitRegex).filter(Boolean);
		return {
			reply: sb.Utils.randArray(prepared),
			cooldown: (context.append.pipe)
				? 0
				: this.Cooldown
		};
	}),
	Dynamic_Description: null
};
