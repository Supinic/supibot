module.exports = {
	Name: "uname",
	Aliases: ["version"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts the current supibot version, along with the latest \"patch notes\"",
	Flags: ["developer","mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function uname () {
		const data = await sb.Got("GitHub", "repos/supinic/supibot/commits").json();
		const commits = data.sort((a, b) => new sb.Date(b.commit.author.date) - new sb.Date(a.commit.author.date));
	
		const { sha, commit } = commits[0];
		const message = commit.message.split("\n")[0];
		return {
			reply: `Last commit: ${sha.slice(0, 7)} - ${message}`
		};
	}),
	Dynamic_Description: null
};
