module.exports = {
	Name: "namechange",
	Aliases: ["nc"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 15000,
	Description: "Search for the last name change of a given Twitch user.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function nameChange () {
		return {
			reply: "Twitch Legal Team has forced CommanderRoot to remove this and many more APIs. https://twitch-tools.rootonline.de/twitch_legal_notice.php"
		};
	}),
	Dynamic_Description: null
};