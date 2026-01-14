import { SupiDate } from "supi-core";

import GiteaHandler from "./gitea.js";
import GithubHandler from "./github.js";
import GitlabHandler from "./gitlab.js";

const handlers = [
	GiteaHandler,
	GithubHandler,
	GitlabHandler
];
const handlerNames = handlers.map(i => i.name);
const defaultHandler = handlers.find(i => i.flags?.default);

export default {
	Name: "commitcount",
	Aliases: ["FarmingCommits"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "For a given GitHub user, this command gives you the number of push events they have done in the last 24 hours. If nothing is provided, your username is used instead.",
	Flags: ["developer","mention","non-nullable","pipe","skip-banphrase"],
	Params: [
		{ name: "since", type: "date" },
		{ name: "type", type: "string" },
		{ name: "host", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function commitCount (context, username) {
		const handler = (context.params.type)
			? handlers[context.params.type]
			: defaultHandler;

		if (!handler) {
			return {
				success: false,
				reply: `Invalid git host type provided! Use one of: ${handlerNames.join(", ")}`
			};
		}

		const threshold = context.params.since ?? new SupiDate().addHours(-24);
		if (threshold >= SupiDate.now()) {
			return {
				success: false,
				reply: "Provided date is in the future!"
			};
		}

		const result = await handler.execute({
			context,
			username,
			threshold,
			host: context.params.host ?? null
		});

		if (result.success === false) {
			return result;
		}

		let since;
		if (context.params.since) {
			since = (result.intervalEnd && result.intervalEnd >= new SupiDate())
				? `between ${context.params.since.format("Y-m-d")} and ${result.intervalEnd.format("Y-m-d")}`
				: `since ${core.Utils.timeDelta(context.params.since)}`;
		}
		else {
			since = "in the past 24 hours";
		}

		let who;
		result.self ??= (context.user.Name === sb.User.normalizeUsername(username));

		if (result.self) {
			who = "You have";
		}
		else {
			who = `${handler.prettyName} user ${username} has`;
		}

		const suffix = (result.commitCount === 1) ? "" : "s";
		return {
			reply: `${who} created ${result.commitCount} commit${suffix} ${since}.`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Checks your or someone else's commit count for the past 24 hours (by default).",
		`If you would like to connect your GitHub account to your "Supibot" (Twitch) account and save some time by not having to type your username, head to <a href="https://supinic.com/">supinic.com</a> - log in, and select <u>GitHub link</u>.`,
		"This command also supports Gitea and Gitlab - along with custom hosts. Check below for proper usage",
		"",

		`<code>${prefix}commitcount</code>`,
		"(amount of commits in the last 24 hours)",
		"",

		`<code>${prefix}commitcount (user)</code>`,
		"(amount of commits of that given user in the last 24 hours)",
		"",

		`<code>${prefix}type:gitea (user)</code>`,
		`<code>${prefix}type:gitlab (user) </code>`,
		"Posts the amount of commits, from the default host of Gitea/Gitlab",
		"",

		`<code>${prefix}type:gitea host:(custom host) (user)</code>`,
		`<code>${prefix}type:gitlab host:(custom host) (user) </code>`,
		`<code>${prefix}type:gitea host:your.gitea.com (user)</code>`,
		`<code>${prefix}type:gitlab host:your.gitlab.com (user) </code>`,
		"Posts the amount of commits, from a custom host of Gitea/Gitlab",
		"",

		`<code>${prefix}commitcount since:(date)</code>`,
		`<code>${prefix}commitcount since:2021-05-01</code>`,
		`<code>${prefix}commitcount since:"2021-01-01 12:30"</code>`,
		"(amount of commits since the provided date)"
	])
};
