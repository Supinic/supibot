module.exports = {
	Name: "randomgondola",
	Aliases: ["rgo"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 20000,
	Description: "Posts a random gondola video, based on the Gondola Stravers API.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomGondola () {
		const { url } = await sb.Got("https://gondola.stravers.net/random");
		return {
			reply: `nymnH ${url} nymnH`
		};
	}),
	Dynamic_Description: null
};