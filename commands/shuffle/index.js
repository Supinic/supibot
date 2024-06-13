const { randomInt } = require("../../utils/command-utils.js");

module.exports = {
	Name: "shuffle",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Shuffles the provided message, word by word.",
	Flags: ["non-nullable","pipe"],
	Params: [
		{ name: "fancy", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function shuffle (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No input provided!"
			};
		}

		let reply;
		if (context.params.fancy) {
			const result = [];
			const message = args.join(" ").split(/\b|\s/).filter(Boolean);
			while (message.length > 0) {
				const randomIndex = randomInt(1, message.length) - 1;
				result.push(message[randomIndex]);
				message.splice(randomIndex, 1);
			}

			reply = result.join(" ").replace(/\s+/g, " ");
		}
		else {
			const result = [];
			const message = [...args];
			while (message.length > 0) {
				const randomIndex = randomInt(1, message.length) - 1;
				result.push(message[randomIndex]);
				message.splice(randomIndex, 1);
			}

			reply = result.join(" ");
		}

		return {
			reply,
			cooldown: {
				length: (context.append.pipe) ? null : this.Cooldown
			}
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"For a given message, shuffles the words around.",
		"",

		`<code>${prefix}shuffle this is a random message</code>`,
		`a random is message this`,
		"",

		`<code>${prefix}shuffle fancy:true (this) isn't a random! message</code>`,
		`) isn a ' ! random this ( message`
	])
};
