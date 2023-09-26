const execute = async (data) => {
	const { username, threshold } = data;

	const response = await sb.Got.gql({
		url: "https://api.github.com/graphql",
		token: sb.Config.get("GITHUB_PUBLIC_REPO_GQL_TOKEN"),
		query: `query ($username: String!, $threshold: DateTime!) {
			user (login: $username) {
				contributionsCollection (from: $threshold) {
					totalCommitContributions
					restrictedContributionsCount
					endedAt
				}
			}
		}`,
		variables: {
			username,
			threshold: threshold.toISOString()
		}
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

	return {
		success: true,
		commitCount,
		intervalEnd
	};
};

module.exports = {
	execute
};
