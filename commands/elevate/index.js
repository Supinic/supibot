module.exports = {
	Name: "elevate",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Transforms a suggestion that you have created into a Github issue, thus \"elevating\" its status. Only usable by people who have linked their Github account via the supinic.com website.",
	Flags: ["developer","mention","non-nullable","opt-out"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		repositoryMap: {
			Backend: "supibot",
			SPM: "supibot-package-manager",
			"Supi-core": "supi-core",
			Website: "supinic.com"
		}
	})),
	Code: (async function elevate (context, ID) {
		const githubData = await context.user.getDataProperty("github");
		if (!githubData) {
			return {
				success: false,
				reply: "Only users with a linked Github account can use this command! Head to supinic.com - log in, and select Github link in your username dropdown."
			};
		}
		else if (!ID) {
			return {
				success: false,
				reply: "No suggestion ID provided!"
			};
		}

		const suggestionID = Number(ID);
		if (!sb.Utils.isValidInteger(suggestionID)) {
			return {
				success: false,
				reply: "Invalid suggestion ID provided!"
			};
		}

		const row = await sb.Query.getRow("data", "Suggestion");
		await row.load(ID, true);
		if (!row.loaded) {
			return {
				success: false,
				reply: "There is no suggestion with that ID!"
			};
		}

		const permissions = await context.getUserPermissions();
		if (!permissions.is("administrator") && context.user.ID !== row.values.User_Alias) {
			return {
				success: false,
				reply: "You are not the author of the suggestion, so you can't elevate it!"
			};
		}
		else if (row.values.Category === "Uncategorized") {
			return {
				success: false,
				reply: "You cannot elevate uncategorized suggestions!"
			};
		}
		else if (row.values.Status !== "Approved") {
			return {
				success: false,
				reply: "You can't elevate suggestions with a status different than \"Approved\"!"
			};
		}

		const repo = this.staticData.repositoryMap[row.values.Category];
		if (!repo) {
			return {
				success: false,
				reply: `Suggestions with category ${row.values.Category} cannot be elevated!`
			};
		}

		const creatorUserData = await sb.User.get(row.values.User_Alias);
		const creatorGithubData = await creatorUserData.getDataProperty("github");
		const authorString = (creatorGithubData?.login)
			? `@${creatorGithubData.login}`
			: creatorUserData.Name;

		const issueText = sb.Utils.escapeHTML(row.values.Text);
		const issueBody = `<a href="//supinic.com/data/suggestion/${ID}">S#${ID}</a> by *${authorString}*\n\n${issueText}`;
		const { statusCode, body: data } = await sb.Got("GitHub", {
			method: "POST",
			responseType: "json",
			throwHttpErrors: false,
			url: `repos/Supinic/${repo}/issues`,
			json: {
				title: `S#${ID} - elevated`,
				body: issueBody
			},
			headers: {
				Authorization: `token ${sb.Config.get("SUPIBOT_GITHUB_TOKEN")}`
			}
		});

		if (statusCode !== 201) {
			console.error("Github issue failed", { statusCode, data });
			return {
				success: false,
				reply: "Github issue creation failed!"
			};
		}

		row.values.Github_Link = `//github.com/Supinic/${repo}/issues/${data.number}`;
		row.values.Status = "Moved to Github";
		row.values.Priority = 100;
		await row.save();

		return {
			reply: `Success! Suggestion was marked as "Moved to Github" and an issue was created: https:${row.values.Github_Link}`
		};
	}),
	Dynamic_Description: null
};
