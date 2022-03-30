module.exports = {
	Name: "artflow",
	Aliases: ["rafi","randomartflowimage"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a random Artflow.ai image along with the prompt that was used to generate it.",
	Flags: ["mention","non-nullable","pipe","skip-banphrase"],
	Params: [
		{ name: "prompt", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		generationUserID: "5555-7f7f-4747-a44b",
		threshold: 20
	})),
	Code: (async function artflow (context, ...args) {
		if (context.params.prompt) {
			return {
				success: false,
				reply: `Unforunately, generating new images is now only available to logged in users! Check https://artflow.ai/ for more info.`
			};
		}

		const imageData = await sb.Query.getRecordset(rs => {
			rs.select("Prompt", "Upload_Link")
				.from("data", "Artflow_Image", "Added")
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
		"Alternatively, lets you create your own pictures with a special parameter.",
		"",

		`<code>${prefix}artflow</code>`,
		"Posts a random picture with a random prompt.",
		"This does NOT generate new things, it only posts pictures that others have created.",
		"",

		`<code>${prefix}artflow (query)</code>`,
		"Posts a random picture where the prompt includes your chosen words or multiple words query.",
		"",

		`<code>${prefix}artflow prompt:(single word)</code>`,
		`<code>${prefix}artflow prompt:"multiple word prompt"</code>`,
		"Creates an Artflow-generated picture based on your prompt.",
		"This might take a long time, so you will only be notified via a reminder when it is finished.",
		"Each user can only have one request pending at a time.",
		""
	])
};
