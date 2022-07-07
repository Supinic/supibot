module.exports = {
	Name: "pick",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Picks a single word from the provided list of words in a message.",
	Flags: ["mention","pipe"],
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
			? new RegExp(sb.Utils.escapeRegExp(context.params.delimiter))
			: /\s+/;

		// normalize input - there might be arguments with other or multiple whitespace inside them
		const prepared = words.join(" ").split(splitRegex).filter(Boolean);
		const word = sb.Utils.randArray(prepared);

		return {
			reply: word,
			cooldown: (context.append.pipe)
				? 0
				: this.Cooldown
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Picks a single word from a list in your message.",
		`This command has no cooldown if used within a <a href="/bot/command/detail/pipe">${prefix}pipe</a> command.`,
		"",

		`<code>${prefix}pick (list of words)</code>`,
		`<code>${prefix}pick a b c d e</code>`,
		"Returns exactly one word - a letter in this case.",
		"The words are separated by any amount of spaces or other whitespace.",

		`<code>${prefix}pick <u>delimiter:;</u> a;b;c;d;e</code>`,
		"Returns exactly one word - like in previous example.",
		"The words are separated by a delimiter character or string of characters, specified by you.",

		"Another example of delimiters:",
		`<code>${prefix}pick <u>delimiter:;</u> one word; two words; three words</code>`,
		"<code>two words</code>"
	])
};
