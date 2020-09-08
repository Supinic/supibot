module.exports = {
	Name: "cytube",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 15000,
	Description: "Posts the link to channel's cytube",
	Flags: ["mention","pipe","whitelist"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function cytube () {
		return {
			reply: "Check it out here: https://cytu.be/r/forsenoffline"
		};
	}),
	Dynamic_Description: null
};