module.exports = {
	Name: "api",
	Aliases: ["apidocs"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 10000,
	Description: "Posts the link for supinic.com API documentation.",
	Flags: ["developer","mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function api () {
		return {
			reply: "https://supinic.com/api"
		}
	}),
	Dynamic_Description: null
};