module.exports = {
	Name: "simplesql",
	Aliases: ["ssql"],
	Author: "supinic",
	Cooldown: 0,
	Description: "Executes a quick SQL query, and returns its (simple) result.",
	Flags: ["mention","pipe","system","whitelist"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function simpleSQL (context, ...args) {
		let query = args.join(" ");
		try {
			if (!query.includes("AVG") && !query.includes("LIMIT 1")) {
				query += " LIMIT 1";
			}
	
			const result = await sb.Query.raw(query);
			if (!result[0]) {
				return {
					reply: "The result has zero rows!"
				};
			}
	
			return { reply: String(result[0][Object.keys(result[0])[0]]) };
		}
		catch (e) {
			console.warn(e);
			return { reply: "An error occured!" };
		}
	}),
	Dynamic_Description: null
};