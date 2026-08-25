import * as z from "zod";
import { SupiDate } from "supi-core";
import type { GitProvider } from "./provider.js";

const errorSchema = z.object({
	errors: z.array(z.object({
		message: z.string()
	}))
});
const successSchema = z.object({
	data: z.object({
		user: z.object({
			contributionsCollection: z.object({
				totalCommitContributions: z.number(),
				restrictedContributionsCount: z.number(),
				endedAt: z.string()
			})
		})
	})
});
const apiShape = z.union([errorSchema, successSchema]);

export default {
	name: "github",
	prettyName: "GitHub",
	flags: {
		default: true
	},
	execute: async (options) => {
		if (!process.env.API_GITHUB_PUBLIC_REPO_GQL_TOKEN) {
			return {
				success: false,
				reply: "No GithHub public repository GQL token configured!"
			};
		}

		let self = false;
		let username = options.username;
		const { user, threshold } = options;

		if (username) {
			const userData = await sb.User.get(username);
			if (userData) {
				const githubData = await userData.getDataProperty("github");
				username = githubData?.login ?? userData.Name;
				self = (userData === user);
			}
		}
		else {
			const githubData = await user.getDataProperty("github");
			username = githubData?.login ?? user.Name;
			self = true;
		}

		const response = await core.Got.gql({
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
		});

		const result = apiShape.parse(response.body);
		if ("errors" in result) {
			return {
				success: false,
				reply: result.errors.map(i => i.message).join("; ")
			};
		}

		const collection = result.data.user.contributionsCollection;
		const intervalEnd = new SupiDate(collection.endedAt);
		const commitCount = collection.totalCommitContributions + collection.restrictedContributionsCount;

		return {
			success: true,
			self,
			commitCount,
			intervalEnd
		};
	}
} satisfies GitProvider;
