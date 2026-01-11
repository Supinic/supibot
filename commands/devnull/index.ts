import { declare } from "../../classes/command.js";

export default declare({
	Name: "devnull",
	Aliases: ["/dev/null", "null"],
	Cooldown: 0,
	Description: "Discards all output. Only usable in pipes.",
	Flags: ["non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: function devnull (context) {
		if (!context.append.pipe) {
			return {
				success: false,
				reply: "This command cannot be used outside of pipe!",
				cooldown: 5000
			};
		}

		return {
			success: true,
			reply: null
		};
	},
	Dynamic_Description: null
});
