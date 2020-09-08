module.exports = {
	Name: "vanishme",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 5000,
	Description: "Posts !vanish",
	Flags: ["pipe","skip-banphrase","system","whitelist"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function vanishMe (context) {
		return {
			reply: "!vanish monkaS"
		};
	}),
	Dynamic_Description: null
};