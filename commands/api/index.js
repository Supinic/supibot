module.exports = {
	Name: "api",
	Aliases: ["apidocs"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts the link for supinic.com API documentation.",
	Flags: ["developer","mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function api () {
		return {
			reply: "https://supinic.com/api"
		};
	}),
	Dynamic_Description: null
};