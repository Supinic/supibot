import * as z from "zod";
import { SupiDate } from "supi-core";
import type { GitProvider } from "./provider.js";

const errorSchema = z.object({ message: z.string().nullish() });
const giteaSchema = z.array(z.object({
	timestamp: z.number(),
	contributions: z.int()
}));

export default {
	name: "gitea",
	prettyName: "Gitea",
	execute: async (options) => {
		const { username, threshold, host } = options;
		if (!host) {
			return {
				success: false,
				reply: `You must provide your Gitea host name!`
			};
		}
		else if (!username) {
			return {
				success: false,
				reply: `You must provide a Gitea username!`
			};
		}

		let response;
		try {
			response = await core.Got.get("GenericAPI")({
				url: `https://${host}/api/v1/users/${username}/heatmap`,
				throwHttpErrors: false
			});
		}
		catch {
			return {
				success: false,
				reply: `Could not query your provided host!`
			};
		}

		if (!response.ok) {
			const { data } = errorSchema.safeParse(response.body);
			return {
				success: false,
				reply: `Could not fetch commit data! Reason: ${data?.message ?? "N/A"}`
			};
		}

		let commitCount = 0;
		const standardTimestamp = new SupiDate(threshold).valueOf() / 1000;
		const data = giteaSchema.parse(response.body);

		for (const item of data) {
			if (item.timestamp >= standardTimestamp) {
				commitCount += item.contributions;
			}
		}

		return {
			success: true,
			commitCount
		};
	}
} satisfies GitProvider;
