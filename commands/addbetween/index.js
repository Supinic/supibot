module.exports = {
	Name: "addbetween",
	Aliases: ["ab"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Fills the message provided with the word (usually an emote) provided as the first argument.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function addBetween (context, word, ...args) {
		if (!word || args.length === 0) {
			return {
				reply: "Both the word and the message must be provided!"
			};
		}
	
		if (args.length === 1) {
			args = Array.from(args[0]);
		}
	
		const result = [];
		for (const messageWord of args) {
			result.push(word);
			result.push(messageWord);
		}
	
		result.push(word);
		return {
			reply: result.join(" "),
			cooldown: {
				length: (context.append.pipe) ? null : this.Cooldown
			}
		};
	}),
	Dynamic_Description: null
};