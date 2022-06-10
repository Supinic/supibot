module.exports = {
	name: "alias-names",
	aliases: ["aliasnames"],
	description: "Checks statistics related to custom command alias names.",
	execute: async (context, type, name) => {
		if (name) {
			const aliases = await sb.Query.getRecordset(rs => rs
				.select("Parent")
				.from("data", "Custom_Command_Alias")
				.where("Name COLLATE utf8mb4_bin = %s", name)
			);

			if (aliases.length === 0) {
				return {
					reply: `Currently, nobody has the "${name}" alias.`
				};
			}

			const copies = aliases.filter(i => i.Parent);
			return {
				reply: sb.Utils.tag.trim `
					Currently, ${aliases.length} users have the "${name}" alias.
					Out of those, ${copies.length} are copies of a different alias.
				`
			};
		}
		else {
			const aliases = await sb.Query.getRecordset(rs => rs
				.select("Name", "COUNT(*) AS Amount")
				.from("data", "Custom_Command_Alias")
				.groupBy("Name COLLATE utf8mb4_bin")
				.orderBy("COUNT(*) DESC")
			);

			const top = aliases
				.slice(0, 10)
				.map((i, ind) => `${ind + 1}) ${i.Name}: ${i.Amount}x`)
				.join(", ");

			return {
				reply: sb.Utils.tag.trim `
					Currently, ${aliases.length} unique alias names are in use.
					The 10 most used names are:
					${top}
				`
			};
		}
	}
};
