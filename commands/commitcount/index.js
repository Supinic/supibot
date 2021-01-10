module.exports = {
	Name: "commitcount",
	Aliases: ["FarmingCommits"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "For a given GitHub user, this command gives you the amount of push events they have done in the last 24 hours. If nothing is provided, your username is used instead.",
	Flags: ["developer","mention","non-nullable","pipe","skip-banphrase"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function commitCount (context, user) {
		let username;
		if (user) {
			const userData = await sb.User.get(user);
			if (userData) {
				username = userData.Data.github?.login ?? userData.Name;
			}
			else {
				username = user;
			}
		}
		else {
			username = context.user.Data.github?.login ?? context.user.Name;
		}
	
		const escaped = encodeURIComponent(username);
		const { body: data, statusCode} = await sb.Got("GitHub", `users/${escaped}/events`);
		if (statusCode !== 200) {
			return {
				success: false,
				reply: `${data.message}`
			};
		}
	
		const threshold = new sb.Date().addHours(-24);
		const pushEvents = data.filter(i => new sb.Date(i.created_at) >= threshold && i.type === "PushEvent");
		const commitCount = pushEvents.reduce((acc, cur) => acc += cur.payload.commits.length, 0);
	
		const suffix = (commitCount === 1) ? "": "s";
		const who = (user === context.user.Name || user === context.user.Data.github?.login)
			? "You have"
			: `GitHub user ${username} has`;
	
		return {
			reply: `${who} created ${commitCount} commit${suffix} in the past 24 hours.`
		};
	}),
	Dynamic_Description: null
};