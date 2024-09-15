const BASE_NEGATIVE_PROMPT = [
	"(deformed distorted disfigured:1.3)",
	"poorly drawn",
	"bad anatomy",
	"wrong anatomy",
	"extra limb",
	"missing limb",
	"floating limbs",
	"(mutated hands and fingers:1.4)",
	"disconnected limbs",
	"mutation",
	"mutated",
	"ugly",
	"disgusting",
	"blurry",
	"amputation",
	"(NSFW:1.25)"
].join(", ");

module.exports = {
	Name: "dalle",
	Aliases: [],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Creates a new DALL-E image based on your prompt, or links an already made one, using the search parameter.",
	Flags: ["mention","non-nullable"],
	Params: [
		{ name: "id", type: "string" },
		{ name: "random", type: "boolean" },
		{ name: "search", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function dallE (context, ...args) {
		if (context.params.search || context.params.random || context.params.id) {
			const { id, random, search } = context.params;
			const image = await sb.Query.getRecordset(rs => rs
				.select("ID", "Prompt", "Created", "Creation_Time")
				.from("data", "DALL-E")
				.orderBy("RAND()")
				.where(
					// In order to search for a prompt, `random` must be falsy and `search` must be provided
					{ condition: Boolean(id) },
					"ID = %s",
					id
				)
				.where(
					// In order to search for a prompt, `random` must be falsy and `search` must be provided
					{ condition: (!id && !random && search) },
					"Prompt %*like*",
					search
				)
				.limit(1)
				.single()
			);

			if (!image) {
				return {
					success: false,
					reply: `No images found for your query!`
				};
			}
			return {
				reply: `https://supinic.com/data/dall-e/detail/${image.ID} DALL-E image set for "${image.Prompt}"`
			};
		}

		const query = args.join(" ");
		if (!query) {
			return {
				success: false,
				reply: `No prompt provided! Check the list of images here: https://supinic.com/data/dall-e/list`
			};
		}

		const sessionHash = sb.Utils.randomString(12);
		await sb.Got("FakeAgent", {
			method: "POST",
			url: "https://ehristoforu-dalle-3-xl-lora-v2.hf.space/queue/join",
			responseType: "json",
			json: {
				data: [
					query,
					BASE_NEGATIVE_PROMPT,
					true,
					2097616390,
					1024,
					1024,
					6,
					true
				],
				event_data: null,
				fn_index: 3,
				trigger_id: 6,
				session_hash: sessionHash
			}
		});

		const response = await sb.Got("FakeAgent", {
			url: "https://ehristoforu-dalle-3-xl-lora-v2.hf.space/queue/data",
			responseType: "text",
			searchParams: {
				session_hash: sessionHash
			}
		});

		if (response.statusCode !== 200) {
			if (response.statusCode === 429 || response.statusCode === 503) {
				return {
					success: false,
					reply: `The service is currently overloaded! Try again later. (status code ${response.statusCode})`
				};
			}
			else {
				console.warn("DALL-E unhandled status code", { response });
				return {
					success: false,
					reply: `The service failed with status code ${response.statusCode}!`
				};
			}
		}

		const dataSlice = response.body.split("data:").at(-1);
		const data = JSON.parse(dataSlice.trim());
		const url = data?.output?.data?.[0]?.[0]?.image.url;
		if (!url) {
			console.warn("Unexpected output", { body: response.body, data, url });
			return {
				success: false,
				reply: "No image extracted SadCat"
			};
		}

		// @todo add database column/table for new style images (also include a type column)

		return {
			cooldown: {
				user: context.user.ID,
				command: this.Name,
				channel: null,
				length: 60_000
			},
			reply: `${url} DALL-E image set for prompt "${query}"`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Creates a DALL-E AI generated image, based on your prompt.",
		"Alternatively, searches for an existing prompt someone else has created.",
		"",

		`<code>${prefix}dalle</code>`,
		"Posts a link to the list of all previously generated images.",
		`<a href="https://supinic.com/data/dall-e/list">https://supinic.com/data/dall-e/list</a>`,
		"",

		`<code>${prefix}dalle (your prompt here)</code>`,
		`<code>${prefix}dalle Billy Herrington as president of the United States</code>`,
		"Creates a set of nine pictures with your prompt, and posts a link to it in the chat.",
		"Warning: This creation can take up to 2-5 minutes, so be patient. When the image is being generated, you cannot use any other commands until it finishes.",
		"Even still, the generation service can be overloaded at times (usually in the evening EU time), in which case you'll have to try again later.",
		"<u>Special cooldown: <code>60 seconds</code></u>",
		"",

		`<code>${prefix}dalle search:(your search here)</code>`,
		`<code>${prefix}dalle search:forsen</code>`,
		`<code>${prefix}dalle search:"my nightmare tonight"</code>`,
		"Searches for an existing image set, based on your prompt - that someone has created before.",
		"",

		`<code>${prefix}dalle id:(post ID)</code>`,
		`<code>${prefix}dalle id:e5832f798a41d335</code>`,
		"Looks up a specific post by its ID",
		"",

		`<code>${prefix}dalle random:true</code>`,
		"Posts a random image set that someone has created before."
	])
};
