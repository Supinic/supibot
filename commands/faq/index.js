module.exports = {
	Name: "faq",
	Aliases: [],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts the link to Supibot's FAQ on the supinic.com website.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function faq () {
	        return {
	            reply: `FAQ list here: https://supinic.com/data/faq/list For discussions, check https://github.com/Supinic/supibot/discussions/ or make a suggestion with the $suggest command.`
	        };
	    }),
	Dynamic_Description: null
};