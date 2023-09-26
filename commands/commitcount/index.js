const allowedHostTypes = ["github", "gitea", "gitlab"];
const DEFAULT_HOST_TYPE = "github";

module.exports = {
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
	Static_Data: null,
	Code: (async function commitCount (context, user) {
		let username;
		let self = false;

		const type = context.params.type ?? DEFAULT_HOST_TYPE;
		if (!allowedHostTypes.includes(type)) {
			return {
				success: false,
				reply: `Invalid host type provided! Use one of: ${allowedHostTypes.join(", ")}`
			};
		}

		if (user) {
			const userData = await sb.User.get(user);
			if (userData) {
				const githubData = await userData.getDataProperty("github");
				username = githubData?.login ?? userData.Name;
				self = (userData === context.user);
			}
			else {
				username = user;
			}
		}
		else if (type === "github") {
			const githubData = await context.user.getDataProperty("github");
			username = githubData?.login ?? context.user.Name;
			self = true;
		}

		const threshold = context.params.since ?? new sb.Date().addHours(-24);
		if (threshold >= sb.Date.now()) {
			return {
				success: false,
				reply: `Who knows how many commits you're capable of? (provided date is located in the future!)`
			};
		}

		const Provider = require(`./${type}.js`);
		const result = await Provider.execute({
			username,
			threshold,
			host: context.params.host ?? null
		});

		if (result.success === false) {
			return result;
		}

		let since;
		if (context.params.since) {
			since = (result.intervalEnd && result.intervalEnd >= new sb.Date())
				? `between ${context.params.since.format("Y-m-d")} and ${result.intervalEnd.format("Y-m-d")}`
				: `since ${sb.Utils.timeDelta(context.params.since)}`;
		}
		else {
			since = "in the past 24 hours";
		}

		let who;
		if (self) {
			who = "You have";
		}
		else if (user && username !== sb.User.normalizeUsername(user)) {
			who = "They have";
		}
		else {
			who = `GitHub user ${username} has`;
		}

		const suffix = (result.commitCount === 1) ? "" : "s";
		return {
			reply: `${who} created ${result.commitCount} commit${suffix} ${since}.`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Checks your or someone else's commit count for the past 24 hours (by default).",
		`If you would like to connect your GitHub account to your "Supibot" (Twitch) account and save some time by not having to type your username, head to <a href="https://supinic.com/">supinic.com</a> - log in, and select <u>Github link</u>.`,
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
