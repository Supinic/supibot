module.exports = {
	name: "aliases",
	aliases: ["alias"],
	description: "Checks the global (or-use data for user-created supibot command aliases.",
	execute: async (context, type, user) => {
		if (user) {
			const userData = await sb.User.get(user);
			if (!userData) {
				return {
					success: false,
					reply: `Provided user does not exist!`
				};
			}

			const [aliases, copyData] = await Promise.all([
				sb.Query.getRecordset(rs => rs
					.select("COUNT(*) AS Count")
					.from("data", "Custom_Command_Alias")
					.where("User_Alias = %n", userData.ID)
					.single()
					.flat("Count")
				),
				sb.Query.getRecordset(rs => rs
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

			const copies = copyData.length;
			const users = new Set(copyData).size;
			const [who, whose] = (context.user === userData) ? ["You", "your"] : ["They", "their"];

			return {
				reply: sb.Utils.tag.trim `
					${who} currently have ${aliases} command aliases,
					and ${users} distinct users have created ${copies} copies of ${whose} aliases.
				`
			};
		}

		const [aliases, copies, users] = await Promise.all([
			sb.Query.getRecordset(rs => rs
				.select("MAX(ID) AS Max")
				.from("data", "Custom_Command_Alias")
				.single()
				.flat("Max")
			),
			sb.Query.getRecordset(rs => rs
				.select("COUNT(*) AS Count")
				.from("data", "Custom_Command_Alias")
				.where("Parent IS NOT NULL")
				.single()
				.flat("Count")
			),
			sb.Query.getRecordset(rs => rs
				.select("COUNT(DISTINCT User_Alias) AS Count")
				.from("data", "Custom_Command_Alias")
				.single()
				.flat("Count")
			)
		]);

		return {
			reply: sb.Utils.tag.trim `
				${aliases} command aliases have been created so far
				(out of which, ${copies} are direct copies of others),
				used by ${users} users in total.
			`
		};
	}
};
