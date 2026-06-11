import type { StatsSubcommandDefinition } from "../index.js";

export default {
	name: "aliases",
	aliases: ["alias"],
	title: "Aliases",
	description: [],
	getDescription: (prefix) => [
		`<code>${prefix}stats aliases</code>`,
		"Checks the statistics of all aliases globally.",
		"",

		`<code>${prefix}stats alias (user)</code>`,
		"Checks the statistics of aliases belonging to the provided user."
	],
	execute: async (context, type, username) => {
		if (username) {
			const userData = await sb.User.get(username);
			if (!userData) {
				return {
					success: false,
					reply: `Provided user does not exist!`
				};
			}

			const [aliases, copiesInfo] = await Promise.all([
				core.Query.getRecordset<number>(rs => rs
					.select("COUNT(*) AS Count")
					.from("data", "Custom_Command_Alias")
					.where("User_Alias = %n", userData.ID)
					.single()
					.flat("Count")
				),
				core.Query.getRecordset<number[]>(rs => rs
					.select("Copy.User_Alias AS Copier")
					.from("data", "Custom_Command_Alias")
					.where("Custom_Command_Alias.User_Alias = %n", userData.ID)
					.join({
						alias: "Copy",
						toTable: "Custom_Command_Alias",
						on: "Copy.Parent = Custom_Command_Alias.ID"
					})
					.flat("Copier")
				)
			]);

			const copies = copiesInfo.length;
			const users = new Set(copiesInfo).size;
			const [who, whose] = (context.user === userData) ? ["You", "your"] : ["They", "their"];

			return {
				success: true,
				reply: core.Utils.tag.trim `
					${who} currently have ${aliases} command aliases,
					and ${users} distinct users have created ${copies} copies of ${whose} aliases.
				`
			};
		}
		else {
			const [aliases, copies, users] = await Promise.all([
				core.Query.getRecordset<number>(rs => rs
					.select("COUNT(*) AS Count")
					.from("data", "Custom_Command_Alias")
					.single()
					.flat("Count")
				),
				core.Query.getRecordset<number>(rs => rs
					.select("COUNT(*) AS Count")
					.from("data", "Custom_Command_Alias")
					.where("Parent IS NOT NULL")
					.single()
					.flat("Count")
				),
				core.Query.getRecordset<number>(rs => rs
					.select("COUNT(DISTINCT User_Alias) AS Count")
					.from("data", "Custom_Command_Alias")
					.single()
					.flat("Count")
				)
			]);

			return {
				success: true,
				reply: core.Utils.tag.trim `
					${aliases} command aliases have been created so far
					(out of which, ${copies} are direct copies of others),
					used by ${users} users in total.
				`
			};
		}
	}
} satisfies StatsSubcommandDefinition;
