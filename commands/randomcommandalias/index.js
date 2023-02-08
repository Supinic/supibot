module.exports = {
	Name: "randomcommandalias",
	Aliases: ["rca"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts a random Supibot command alias. Can be configured to create a somewhat precise search query.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "body", type: "string" },
		{ name: "command", type: "string" },
		{ name: "createdAfter", type: "date" },
		{ name: "createdBefore", type: "date" },
		{ name: "description", type: "string" },
		{ name: "name", type: "string" },
		{ name: "user", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomCommandAlias (context) {
		const targetUserAlias = (context.params.user)
			? await sb.User.get(context.params.user)
			: null;

		if (context.params.user && !targetUserAlias) {
			return {
				success: false,
				reply: `Provided user does not exist!`
			};
		}

		const randomAlias = await sb.Query.getRecordset(rs => rs
			.select("ID", "User_Alias", "Name")
			.from("data", "Custom_Command_Alias")
			.where({ condition: Boolean(context.params.body) }, "Arguments %*like*", context.params.body)
			.where({ condition: Boolean(context.params.command) }, "Command = %s", context.params.command)
			.where({ condition: Boolean(context.params.createdAfter) }, "Created > %d", context.params.createdAfter)
			.where({ condition: Boolean(context.params.createdBefore) }, "Created < %d", context.params.createdBefore)
			.where({ condition: Boolean(context.params.description) }, "Description %*like*", context.params.description)
			.where({ condition: Boolean(context.params.name) }, "Name = %s", context.params.name)
			.where({ condition: Boolean(targetUserAlias) }, "User_Alias = %n", targetUserAlias?.ID)
			.where("Command IS NOT NULL")
			.where("Parent IS NULL OR Edited IS NOT NULL") // either an original alias or an edited copy
			.orderBy("RAND()")
			.limit(1)
			.single()
		);

		if (!randomAlias) {
			return {
				success: false,
				reply: `No command alias has been found for your query!`
			};
		}

		const authorData = await sb.User.get(randomAlias.User_Alias);
		const unpingedAuthorName = `${authorData.Name[0]}\u{E0000}${authorData.Name.slice(1)}`;
		return {
			reply: `
				Random alias "${randomAlias.Name}" made by ${unpingedAuthorName} for your query:
				https://supinic.com/bot/user/alias/detail/${randomAlias.ID}				
			`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Posts a random command alias -- either completely random or filtered by parameters",
		"Unchanged alias copies and linked aliases will not be rolled - as they are identical to their parent aliases.",
		`For more info about aliases, check the <a href="/bot/command/detail/alias">${prefix}alias command</a>.`,
		"",

		`<code>${prefix}rca</code>`,
		"Posts a completely random command alias.",
		"",

		`<code>${prefix}rca body:(definition)</code>`,
		"Filters aliases by their definition contents, e.g. parameters, arguments, pipe commands, ...",
		"",

		`<code>${prefix}rca command:(command name)</code>`,
		"Filters aliases by ones that use the specified command as their main command (e.g. not inside of <code>$pipe</code>).",
		"",

		`<code>${prefix}rca createdAfter:(date)</code>`,
		`<code>${prefix}rca createdBefore:(date)</code>`,
		"Filters aliases by their creation time.",
		"",

		`<code>${prefix}rca description:(description)</code>`,
		"Filters aliases by their description. Ignores commands with no description.",
		"",

		`<code>${prefix}rca name:(name)</code>`,
		"Filters aliases by their names.",
		"",

		`<code>${prefix}rca user:(user name)</code>`,
		"Filters aliases by their owners.",
		""
	])
};
