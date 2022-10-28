module.exports = {
	Name: "cytube",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Posts the link to the channel's CyTube.",
	Flags: ["mention","pipe","whitelist"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function cytube () {
		return {
			reply: "Check it out here: https://cytu.be/r/forsenoffline"
		};
	}),
	Dynamic_Description: null
};
