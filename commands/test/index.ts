import { declare } from "../../classes/command.js";

export default declare({
	Name: "test",
	Aliases: null,
	Cooldown: 5000,
	Description: "Test.",
	Flags: ["developer", "pipe", "skip-banphrase", "system"],
	Params: [
		{ name: "boolean", type: "boolean" },
		{ name: "date", type: "date" },
		{ name: "number", type: "number" },
		{ name: "object", type: "object" },
		{ name: "regex", type: "regex" },
		{ name: "string", type: "string" }
	],
	Whitelist_Response: "For debugging purposes only :)",
	Code: function test (context) {
		return {
			success: true,
			reply: (context.params.string)
				? `param: ${context.params.string}`
				: "Test successful"
		};
	},
	Dynamic_Description: null
});
