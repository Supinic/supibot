module.exports = {
	name: "aliases",
	aliases: ["alias"],
	description: "Checks the statistics of either: all aliases globally; or aliases of a provided user; or a specific alias by a provided user.",
	execute: async (context, type, userName, aliasName) => {
		if (userName) {
			const userData = await sb.User.get(userName);
			if (!userData) {
				return {
					success: false,
					reply: `Provided user does not exist!`
				};
			}

			const pronoun = (userData === context.user) ? "You" : "They";
			const posPronoun = (userData === context.user) ? "Your" : "Their";
			if (aliasName) {
				const aliasData = await sb.Query.getRecordset(rs => rs
					.select("ID", "Parent")
					.from("data", "Custom_Command_Alias")
					.where("User_Alias = %n", userData.ID)
					.where("Name = %s", aliasName)
					.where("Parent IS NULL")
					.single()
				);

				if (!aliasData) {
					return {
						success: false,
						reply: `${pronoun} don't have an alias with that name!`
					};
				}
				else if (aliasData.Parent) {
					return {
						success: false,
						reply: `This alias is a copy or a link to an existing alias and hence has no statistics available!`
					};
				}

				/** @type { { Invocation: string|null }[] } */
				const data = await sb.Query.getRecordset(rs => rs
					.select("Invocation")
					.from("data", "Custom_Command_Alias")
					.where("User_Alias <> %n", userData.ID)
					.where("Parent = %n", aliasData.ID)
				);

				const [copies, links] = sb.Utils.splitByCondition(data, i => i.Invocation);
				return {
					reply: `${posPronoun} alias "${aliasName}" has been copied ${copies.length} times, and linked ${links.length} times by other users.`
				};
			}
			else {
				/** @type {[number[], number[]]} */
				const data = await Promise.all([
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

				const [aliases, copyData] = data;
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
		}
		else {
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
	}
};
