import * as z from "zod";
import { declare } from "../../classes/command.js";

const simpleQuerySchema = z.array(z.record(z.string(), z.unknown()));

export default declare({
	Name: "simplesql",
	Aliases: ["ssql"],
	Cooldown: 0,
	Description: "Executes a quick SQL query, and returns its (simple) result.",
	Flags: ["mention", "pipe", "system", "whitelist"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function simpleSQL (context, ...args) {
		let query = args.join(" ");
		if (!query.includes("AVG") && !query.includes("LIMIT 1")) {
			query += " LIMIT 1";
		}

		try {
			const rawResult = await core.Query.raw(query);
			const result = simpleQuerySchema.parse(rawResult);
			if (!result[0]) {
				return {
					success: false,
					reply: "The result has zero rows!"
				};
			}

			const [item] = result;
			const [key] = Object.keys(item);
			const value = item[key];

			return {
				success: true,
				reply: String(value)
			};
		}
		catch (e) {
			console.warn("$simplesql error", { e });
			return {
				success: false,
				reply: "An error occurred!"
			};
		}
	}),
	Dynamic_Description: null
});
