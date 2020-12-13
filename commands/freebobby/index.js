module.exports = {
	Name: "freebobby",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "When is Bobby Shmurda going to be freed? TriHard",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function freeBobby () {
		const now = sb.Date.now();
		const start = new sb.Date("2014-12-20");
		const free = new sb.Date("2021-12-11");
		const percent = sb.Utils.round(100 * (now - start) / (free - start), 2);

		return { 
			reply: sb.Utils.tag.trim `
				Our boy should have been set free in December 2020, but his parole has been denied.
				He will most likely serve the rest of his sentence, getting out ${sb.Utils.timeDelta(free)}.
				Overall, he has served ${percent}% of the sentence.
				TriHard
			`
		};
	}),
	Dynamic_Description: null
};