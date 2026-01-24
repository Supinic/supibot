import { declare } from "../../classes/command.js";
import { randomInt } from "../../utils/command-utils.js";

export default declare({
	Name: "shuffle",
	Aliases: null,
	Cooldown: 10000,
	Description: "Shuffles the provided message, word by word.",
	Flags: ["non-nullable","pipe"],
	Params: [{ name: "fancy", type: "boolean" }],
	Whitelist_Response: null,
	Code: function shuffle (context, ...args) {
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

			reply = result.join(" ").replaceAll(/\s+/g, " ");
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
			success: true,
			cooldown: {
				length: (context.append.pipe) ? null : this.Cooldown
			}
		};
	},
	Dynamic_Description: (prefix) => [
		"For a given message, shuffles the words around.",
		"",

		`<code>${prefix}shuffle (message)</code>`,
		"Shuffles the message word by word, split by spaces.",
		`<code>this is a random message</code> → <code>random is message this</code>`,
		`<code>(this is a random) message</code> → <code>random) is message (this</code>`,
		"",

		`<code>${prefix}shuffle fancy:true (message)</code>`,
		"Shuffles the message word by word, splitting off non-letter characters.",
		`<code>(this) isn't random!</code> → <code>) isn a ' ! random this ( message</code>`,
	]
});
