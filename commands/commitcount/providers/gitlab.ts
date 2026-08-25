import * as z from "zod";
import { SupiDate } from "supi-core";
import type { GitProvider } from "./provider.js";

const errorSchema = z.object({ message: z.string().nullish() });
const gitlabSchema = z.record(z.string(), z.number());

export default {
	name: "gitlab",
	prettyName: "GitLab",
	execute: async (options) => {
		const { username, threshold, host } = options;

		if (!host) {
			return {
				success: false,
				reply: `You must provide your GitLab host name!`
			};
		}
		else if (!username) {
			return {
				success: false,
				reply: `You must provide a GitLab username!`
			};
		}

		let response;
		try {
			response = await core.Got.get("GenericAPI")({
				url: `https://${host}/users/${username}/calendar.json`,
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
		const thresholdDate = new SupiDate(threshold.format("Y-m-d"));
		const data = gitlabSchema.parse(response.body);

		for (const [date, contributions] of Object.entries(data)) {
			const dateStamp = new SupiDate(date);
			if (dateStamp >= thresholdDate) {
				commitCount += contributions;
			}
		}

		return {
			success: true,
			commitCount
		};
	}
} satisfies GitProvider;
