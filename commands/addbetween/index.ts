import { declare } from "../../classes/command.js";

export default declare({
	Name: "addbetween",
	Aliases: ["ab"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Fills the message provided with the word (usually an emote) provided as the first argument.",
	Flags: ["external-input","mention","pipe"],
	Params: [{ name: "sentences", type: "boolean" }],
	Whitelist_Response: null,
	Code: function addBetween (context, word, ...args) {
		if (!word || args.length === 0) {
			return {
				success: false,
				reply: "Both the word and the message must be provided!"
			};
		}

		let nodes = args;
		if (context.params.sentences) {
			nodes = args.join(" ").split(/[?!.]/);
		}
		else if (args.length === 1) {
			// eslint-disable-next-line @typescript-eslint/no-misused-spread
			nodes = [...args[0]];
		}

		const result = [];
		for (const messageWord of nodes) {
			result.push(word, messageWord);
		}

		result.push(word);

		return {
			reply: result.join(" "),
			cooldown: {
				length: (context.append.pipe) ? null : this.Cooldown
			}
		};
	},
	Dynamic_Description: null
});
