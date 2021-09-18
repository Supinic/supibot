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
	Code: (async function artflow (context, word) {
		if (context.params.prompt) {
			const rawPrompts = await sb.Cache.server.hgetall("artflow");
			const existingPrompts = Object.values(rawPrompts).map(i => JSON.parse(i));
			if (existingPrompts.length >= this.staticData.threshold) {
				return {
					success: false,
					reply: `There are too many prompts being processed right now! Try again later.`
				};
			}

			const pending = existingPrompts.find(i => i.user === context.user.ID);
			if (pending.length > 0) {
				const range = [
					Math.trunc(pending.queue / 30),
					Math.trunc(pending.queue / 12)
				];

				return {
					success: false,
					reply: sb.Utils.tag.trim `
						You already have a pending request "${pending.prompt}"!
						Your queue rank is ${pending.queue},
						and it should be finished in around ${range[0]} to ${range[1]} minutes.
					`
				};
			}

			const artflowUserID = this.staticData.generationUserID;
			const formData = new sb.Got.FormData();
			formData.append("user_id_val", artflowUserID);
			formData.append("text_prompt", context.params.prompt);

			const response = await sb.Got("FakeAgent", {
				method: "POST",
				url: "https://artflow.ai/add_to_generation_queue",
				headers: {
					"x-requested-with": "XMLHttpRequest",
					...formData.getHeaders()
				},
				body: formData.getBuffer(),
				referrer: "https://artflow.ai/"
			});

			if (response.statusCode !== 200) {
				return {
					success: false,
					reply: `Image generation did not succeed! Please try again later.`
				};
			}

			const uuid = require("crypto").randomUUID();
			const requestObject = {
				artflowUserID,
				user: context.user.ID,
				channel: context.channel?.ID ?? null,
				platform: context.platform?.ID ?? null,
				imageIndex: response.body.index,
				prompt: context.params.prompt,
				queue: response.body.queue_length
			};

			await sb.Cache.server.hset("artflow", uuid, JSON.stringify(requestObject));

			const range = [
				Math.trunc(response.body.queue_length / 30),
				Math.trunc(response.body.queue_length / 12)
			];

			return {
				reply: sb.Utils.tag.trim `
					Your Artflow image will be ready in around ${range[0]} to ${range[1]} minutes. 
					You will receive a system reminder when it is finished.
				`
			};
		}

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

		const searchString = (word) ? ` for the word "${word}" -` : "";
		const postedDelta = (imageData.Added)
			? `(posted ${sb.Utils.timeDelta(imageData.Added)})`
			: "";

		return {
			reply: `Your random prompt${searchString} "${imageData.Prompt}": ${imageData.Upload_Link} ${postedDelta}`
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
		"Posts a random picture where the prompt includes your chosen word.",
		"",

		`<code>${prefix}artflow prompt:(single word)</code>`,
		`<code>${prefix}artflow prompt:"multiple word prompt"</code>`,
		"Creates an Artflow-generated picture based on your prompt.",
		"This might take a long time, so you will only be notified via a reminder when it is finished.",
		"Each user can only have one request pending at a time.",
		""
	])
};
