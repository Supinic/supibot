module.exports = {
	Name: "test",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "?",
	Flags: ["developer","pipe","skip-banphrase","system"],
	Params: null,
	Whitelist_Response: "For debugging purposes only :)",
	Static_Data: null,
	Code: (async function test () {
		return {
			success: false,
			reply: `test`
		};
	}),
	Dynamic_Description: null
};