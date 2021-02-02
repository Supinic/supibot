module.exports = {
	Name: "randomgondola",
	Aliases: ["rgo"],
	Author: "supinic",
	Cooldown: 20000,
	Description: "Posts a random gondola video, based on the Gondola Stravers API.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
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