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
	Code: (async function artflow (context, word) {
		const imageData = await sb.Query.getRecordset(rs => {
			rs.select("Prompt", "Upload_Link")
				.from("data", "Artflow_Image", "Added")
				.orderBy("RAND()")
				.limit(1)
				.single();

			if (word) {
				rs.where("Prompt %*like*", word.toLowerCase());
			}

			return rs;
		});

		if (!imageData) {
			return {
				success: false,
				reply: `No image has been found!`
			};
		}

		const postedDelta = (imageData.Added)
			? `(posted ${sb.Utils.timeDelta(imageData.Added)})`
			: "";

		return {
			reply: `Your random prompt "${imageData.Prompt}": ${imageData.Upload_Link} ${postedDelta}`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		`Fetches a random <a href="//artflow.ai">Artflow.ai</a> image along with the prompt that was used to generate it.`,
		"This command does NOT generate new things, it only posts pictures that others have created.",
		"",

		`<code>${prefix}artflow</code>`,
		"Posts a random picture with a random prompt.",
		"",

		`<code>${prefix}artflow (single word)</code>`,
		"Posts a random picture where the prompt includes your chosen word."
	])
};
