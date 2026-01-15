import { declare } from "../../classes/command.js";

export default declare({
	Name: "sort",
	Aliases: null,
	Cooldown: 5000,
	Description: "Alphabetically sorts the message provided to this command.",
	Flags: ["non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: function sort (context, ...args) {
		if (args.length < 2) {
			return {
				success: false,
				reply: "You must supply at least two words!"
			};
		}

		const reply = args.sort().join(" ");
		return {
			success: true,
			reply,
			cooldown: (context.append.pipe)
				? null // skip cooldown in pipe
				: this.Cooldown // apply regular cooldown inside of pipe
		};
	},
	Dynamic_Description: null
});
