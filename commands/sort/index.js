module.exports = {
	Name: "sort",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Sorts the message provided alphabetically.",
	Flags: ["pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function sort (context, ...args) {
		if (args.length < 2) {
			return {
				success: false,
				reply: "You must supply at least two words!"
			};
		}
	
		const reply = args.sort().join(" ");
		return {
			reply: reply,
			cooldown: (context.append.pipe)
				? null // skip cooldown in pipe
				: this.Cooldown // apply regular cooldown inside of pipe
		};
	}),
	Dynamic_Description: null
};