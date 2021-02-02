module.exports = {
	Name: "levelchange",
	Aliases: ["lc"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Search for the last level change (default, staff, admin, ...) of a given Twitch user.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function levelChange () {
		return {
			reply: "Twitch Legal Team has forced CommanderRoot to remove this and many more APIs. https://twitch-tools.rootonline.de/twitch_legal_notice.php"
		};
	}),
	Dynamic_Description: null
};