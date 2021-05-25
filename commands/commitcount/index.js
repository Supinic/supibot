module.exports = {
	Name: "commitcount",
	Aliases: ["FarmingCommits"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "For a given GitHub user, this command gives you the amount of push events they have done in the last 24 hours. If nothing is provided, your username is used instead.",
	Flags: ["developer","mention","non-nullable","pipe","skip-banphrase"],
	Params: [
		{ name: "since", type: "date" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function commitCount (context, user) {
		let username;
		let self = false;

		if (user) {
			const userData = await sb.User.get(user);
			if (userData) {
				self = (userData === context.user);
				username = userData.Data.github?.login ?? userData.Name;
			}
			else {
				username = user;
			}
		}
		else {
			username = context.user.Data.github?.login ?? context.user.Name;
			self = true;
		}

		const threshold = context.params.since ?? new sb.Date().addHours(-24);
		if (threshold >= sb.Date.now()) {
			return {
				success: false,
				reply: `Who knows how many commits you're capable of? (provided date is located in the future!)`
			};
		}

		const response = await sb.Got.gql({
			url: "https://api.github.com/graphql",
			token: sb.Config.get("GITHUB_PUBLIC_REPO_GQL_TOKEN"),
			query: `{
				user(login: "${username}") {
					contributionsCollection(from: "${threshold.toISOString()}") {
						totalCommitContributions
						restrictedContributionsCount
						endedAt 
					}
				}
			}`
		}).json();

		if (response.errors) {
			return {
				success: false,
				reply: response.errors.map(i => i.message).join("; ")
			};
		}

		const collection = response.data.user.contributionsCollection;
		const intervalEnd = new sb.Date(collection.endedAt);
		const commitCount = collection.totalCommitContributions + collection.restrictedContributionsCount;

		let since;
		if (context.params.since) {
			since = (intervalEnd >= new sb.Date())
				? `since ${sb.Utils.timeDelta(context.params.since)}`
				: `between ${context.params.since.format("Y-m-d")} and ${intervalEnd.format("Y-m-d")}`;
		}
		else {
			since = "in the past 24 hours";
		}

		const suffix = (commitCount === 1) ? "" : "s";
		const who = (self) ? "You have" : `GitHub user ${username} has`;
		return {
			reply: `${who} created ${commitCount} commit${suffix} ${since}.`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Checks your or someone else's commit count for the past 24 hours (by default).",
		`If you would like to connect your GitHub account to your "Supibot" (Twitch) account and save some time by not having to type your username, head to <a href="https://supinic.com/">supinic.com</a> - log in, and select <u>Github link</u>.`,
		"",

		`<code>${prefix}commitcount</code>`,
		"(amount of commits in the last 24 hours)",
		"",

		`<code>${prefix}commitcount (user)</code>`,
		"(amount of commits of that given user in the last 24 hours)",
		"",

		`<code>${prefix}commitcount since:(date)</code>`,
		`<code>${prefix}commitcount since:2021-05-01</code>`,
		`<code>${prefix}commitcount since:"2021-01-01 12:30"</code>`,
		"(amount of commits since the provided date)"
	])
};
