module.exports = {
	Name: "haHAA",
	Aliases: ["4Head","4HEad","HEad"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts a random, hilarious joke, 100% guaranteed.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function _4head (context) {
		const data = await sb.Got("https://icanhazdadjoke.com/").json();
		return {
			reply: `${data.joke} ${context.invocation}`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Posts a random, 100% hilarious dad joke.",
		"Guaranteed to make you grimace",
		"",
	
		`<code>${prefix}4Head</code>`,
		"(random joke)"
	])
};
