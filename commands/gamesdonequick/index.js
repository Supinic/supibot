export default {
	Name: "gamesdonequick",
	Aliases: ["gdq"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts a Markov chain-generated GDQ speedrun donation message.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function speedrun () {
		const { comment } = await core.Got.get("IVR")("gdq").json();
		return {
			reply: comment
		};
	}),
	Dynamic_Description: null
};
