module.exports = {
	Name: "commitcount",
	Aliases: ["FarmingCommits"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "For a given GitHub user, this command gives you the amount of push events they have done in the last 24 hours. If nothing is provided, your username is used instead.",
	Flags: ["developer","mention","non-nullable","pipe","skip-banphrase"],
	Params: null,
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

		const threshold = new sb.Date().addHours(-24).toISOString();
		const response = await sb.Got.gql({
			url: "https://api.github.com/graphql",
			token: sb.Config.get("GITHUB_PUBLIC_REPO_GQL_TOKEN"),
			query: `{
				user(login: "${username}") {
					contributionsCollection(from: "${threshold}") {
						totalCommitContributions
						restrictedContributionsCount
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
		const commitCount = collection.totalCommitContributions + collection.restrictedContributionsCount;

		const suffix = (commitCount === 1) ? "": "s";
		const who = (self) ? "You have" : `GitHub user ${username} has`;
		return {
			reply: `${who} created ${commitCount} commit${suffix} in the past 24 hours.`
		};
	}),
	Dynamic_Description: null
};