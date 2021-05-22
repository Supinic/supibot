module.exports = {
	Name: "freebobby",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "When is Bobby Shmurda going to be freed? TriHard",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function freeBobby () {
		const conditional = new sb.Date("2021-02-23 19:00"); // date = static, time = estimated
		return {
			reply: sb.Utils.tag.trim `
				Our boy should have been set free in December 2020, but his parole has been denied.
				However, after a review by the Department of Corrections in February 2021, 
				his credit for good institutional behavior qualified him for a conditional release 
				${sb.Utils.timeDelta(conditional)},
				given the rest of his sentence is to be served on parole (up until 2026).
				TriHard
			`
		};
	}),
	Dynamic_Description: null
};
