module.exports = {
	Name: "shuffle",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Shuffles the provided message, word by word.",
	Flags: ["pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function shuffle (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No input provided!"
			};
		}
	
		const result = [];
		const message = args.join(" ").split(/\b|(?:(\s))/).filter(Boolean);
		while (message.length > 0) {
			const randomIndex = sb.Utils.random(0, message.length - 1);
			result.push(message[randomIndex]);
			message.splice(randomIndex, 1);
		}
	
		const reply = result.join(" ");
		return { 
			reply: reply,
			cooldown: {
				length: (context.append.pipe) ? null : this.Cooldown
			}
		};
	}),
	Dynamic_Description: null
};