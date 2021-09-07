module.exports = {
	Name: "test",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "?",
	Flags: ["developer","pipe","skip-banphrase","system","use-params"],
	Params: [
		{ name: "boolean", type: "boolean" },
		{ name: "date", type: "date" },
		{ name: "number", type: "number" },
		{ name: "object", type: "object" },
		{ name: "regex", type: "regex" },
		{ name: "string", type: "string" }
	],
	Whitelist_Response: "For debugging purposes only :)",
	Static_Data: null,
	Code: (async function test (context) {
		return {
			reply: `param: ${context.params.string ?? "(none)"}`
		};
	}),
	Dynamic_Description: null
};
