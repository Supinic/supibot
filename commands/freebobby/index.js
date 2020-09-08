module.exports = {
	Name: "freebobby",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 15000,
	Description: "When is Bobby Shmurda going to be freed? TriHard",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: async () => {
		const free = new sb.Date("2020-12-11");
		return { reply: "Our boy might be free " + sb.Utils.timeDelta(free) + " if he gets his parole TriHard" };
	},
	Dynamic_Description: null
};