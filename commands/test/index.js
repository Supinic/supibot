module.exports = {
	Name: "test",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "?",
	Flags: ["developer","pipe","skip-banphrase","system","use-params"],
	Params: [
		{ name: "string", type: "string" }
	],
	Whitelist_Response: "For debugging purposes only :)",
	Static_Data: null,
	Code: (async function test () {
		return {
			reply: `param: ${context.params.string ?? "(none)"}`
		};
	}),
	Dynamic_Description: null
};