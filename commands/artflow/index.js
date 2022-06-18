module.exports = {
	Name: "artflow",
	Aliases: ["rafi","randomartflowimage"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a random Artflow.ai image along with the prompt that was used to generate it.",
	Flags: ["mention","non-nullable","pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function artflow (context, ...args) {
		const imageData = await sb.Query.getRecordset(rs => {
			rs.select("Prompt", "Upload_Link", "Added")
				.from("data", "Artflow_Image")
				.orderBy("RAND()")
				.limit(1)
				.single();

			if (args.length !== 0) {
				for (const word of args) {
					rs.where("Prompt %*like*", word);
				}
			}

			return rs;
		});

		if (!imageData) {
			return {
				success: false,
				reply: `No image has been found!`
			};
		}

		const query = args.join(" ");
		const searchString = (query) ? ` for the query "${query}" -` : "";
		const postedDelta = (imageData.Added)
			? `(posted ${sb.Utils.timeDelta(imageData.Added)})`
			: "";

		return {
			reply: `Your random prompt${searchString} "${imageData.Prompt}": ${imageData.Upload_Link} ${postedDelta}`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		`Fetches a random <a href="//artflow.ai">Artflow.ai</a> image along with the prompt that was used to generate it.`,
		"",

		`<code>${prefix}artflow</code>`,
		"Posts a random picture with a random prompt.",
		"This does NOT generate new things, it only posts pictures that others have created.",
		"",

		`<code>${prefix}artflow (query)</code>`,
		"Posts a random picture where the prompt includes your chosen words or multiple words query.",
		""
	])
};
