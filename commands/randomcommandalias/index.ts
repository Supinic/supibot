import { TWITCH_ANTIPING_CHARACTER } from "../../utils/command-utils.js";
import { declare } from "../../classes/command.js";
import type { User } from "../../classes/user.js";

type AliasData = {
	ID: number;
	User_Alias: User["ID"];
	Name: string;
};

export default declare({
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

		const randomAlias = await core.Query.getRecordset<AliasData | undefined>(rs => {
			rs.select("ID", "User_Alias", "Name")
				.from("data", "Custom_Command_Alias")
				.where("Command IS NOT NULL")
				.where("Parent IS NULL OR Edited IS NOT NULL") // either an original alias or an edited copy
				.orderBy("RAND()")
				.limit(1)
				.single();

			if (context.params.body) {
				rs.where("Arguments %*like*", context.params.body);
			}
			if (context.params.command) {
				rs.where("Command = %s", context.params.command);
			}
			if (context.params.createdAfter) {
				rs.where("Created > %d", context.params.createdAfter);
			}
			if (context.params.createdBefore) {
				rs.where("Created < %d", context.params.createdBefore);
			}
			if (context.params.description) {
				rs.where("Description %*like*", context.params.description);
			}
			if (context.params.name) {
				rs.where("Name = %s", context.params.name);
			}
			if (targetUserAlias) {
				rs.where("User_Alias = %n", targetUserAlias.ID);
			}

			return rs;
		});
		if (!randomAlias) {
			return {
				success: false,
				reply: `No command alias has been found for your query!`
			};
		}

		const authorData = await sb.User.getAsserted(randomAlias.User_Alias);
		const unpingedAuthorName = `${authorData.Name[0]}${TWITCH_ANTIPING_CHARACTER}${authorData.Name.slice(1)}`;
		return {
			success: true,
			reply: core.Utils.tag.trim `
				Random alias "${randomAlias.Name}" made by ${unpingedAuthorName} for your query:
				https://supinic.com/bot/user/alias/detail/${randomAlias.ID}				
			`
		};
	}),
	Dynamic_Description: (prefix) => [
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
	]
});
