module.exports = {
	Name: "vanishme",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts !vanish",
	Flags: ["pipe","skip-banphrase","system","whitelist"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function vanishMe (context) {
		return {
			reply: "!vanish monkaS"
		};
	}),
	Dynamic_Description: null
};