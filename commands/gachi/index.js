module.exports = {
	Name: "gachi",
	Aliases: ["gachilist","gl"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts the link of gachimuchi list on supinic.com",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function gachiList () { 
		return {
			reply: "https://supinic.com/track/gachi/list"
		};
	}),
	Dynamic_Description: null
};