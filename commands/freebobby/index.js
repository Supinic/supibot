module.exports = {
	Name: "freebobby",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-22T15:42:24.000Z",
	Cooldown: 15000,
	Description: "When is Bobby Shmurda going to be freed? TriHard",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function freeBobby () {
		const probably = new sb.Date("2020-12-11");
		const free = new sb.Date("2021-12-11");
	
		return { 
			reply: sb.Utils.tag.trim `
				Our boy might be free ${sb.Utils.timeDelta(probably)},
				but his parole seems to have been denied on 2020-09-21,
				and he will most likely serve the rest of his sentence,
				getting out ${sb.Utils.timeDelta(free)}
				TriHard
			`
		};
	}),
	Dynamic_Description: null
};