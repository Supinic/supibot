module.exports = {
	Name: "pick",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 10000,
	Description: "Picks a single word from the provided list of words in a message.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function pick (context, ...words) {
		if (words.length === 0) {
			return {
				reply: "No input provided!"
			}
		}
	
		return {
			reply: sb.Utils.randArray(words),
			cooldown: (context.append.pipe)
				? 0
				: this.Cooldown
		}
	}),
	Dynamic_Description: null
};