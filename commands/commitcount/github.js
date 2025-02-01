const execute = async (data) => {
	if (!process.env.API_GITHUB_PUBLIC_REPO_GQL_TOKEN) {
		return {
			success: false,
			reply: "No GithHub public repository GQL token configured!"
		};
	}

	let self = false;
	let username = data.username;
	const { context, threshold } = data;

	if (username) {
		const userData = await sb.User.get(username);
		if (userData) {
			const githubData = await userData.getDataProperty("github");
			username = githubData?.login ?? userData.Name;
			self = (userData === context.user);
		}
	}
	else {
		const githubData = await context.user.getDataProperty("github");
		username = githubData?.login ?? context.user.Name;
		self = true;
	}

	const response = await sb.Got.gql({
		url: "https://api.github.com/graphql",
		token: process.env.API_GITHUB_PUBLIC_REPO_GQL_TOKEN,
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
		self,
		commitCount,
		intervalEnd
	};
};

export default {
	name: "github",
	prettyName: "GitHub",
	flags: {
		default: true
	},
	execute
};
