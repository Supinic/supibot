import { declare } from "../../classes/command.js";

export default declare({
	Name: "dalle",
	Aliases: [],
	Cooldown: 5000,
	Description: "Fetches a random premade DALL-E image, either randomly or based on your search query.",
	Flags: ["mention"],
	Params: [{ name: "id", type: "string" }],
	Whitelist_Response: null,
	Code: (async function dallE (context, ...args) {
		const search = args.join(" ");
		if (search === "list") {
			// hardcoded option to show the link
			return {
				success: true,
				reply: `Check the list of images here: https://supinic.com/data/dall-e/list`
			};
		}

		const { id } = context.params;
		const isRandom = (args.length === 0);
		const image = await core.Query.getRecordset<{ ID: number; Prompt: string; } | undefined>(rs => {
			rs.select("ID", "Prompt", "Created", "Creation_Time")
				.from("data", "DALL-E")
				.orderBy("RAND()")
				.limit(1)
				.single();

			if (id) {
				rs.where("ID = %s", id);
			}
			if (!id && !isRandom && search) {
				rs.where("Prompt %*like*", search);
			}

			return rs;
		});

		if (!image) {
			return {
				success: false,
				reply: `No images found for your query!`
			};
		}

		return {
			success: true,
			reply: `https://supinic.com/data/dall-e/detail/${image.ID} DALL-E image set for "${image.Prompt}"`
		};
	}),
	Dynamic_Description: (prefix) => [
		"Searches for a DALL-E set of AI generated images, based on other people creating them.",
		"The generation is broken since July 2025, so no more images can be created at the moment.",
		"",

		`<code>${prefix}dalle</code>`,
		"Posts a link to a random set of generated images.",
		"",

		`<code>${prefix}dalle list</code>`,
		"Posts a link to the list of all sets on the website.",
		`<a href="/data/dall-e/list">https://supinic.com/data/dall-e/list</a>`,
		"",

		`<code>${prefix}dalle (your prompt here)</code>`,
		`<code>${prefix}dalle Billy Herrington as president of the United States</code>`,
		"Searches for an existing image set, based on your prompt - that someone has created before.",
		"",

		`<code>${prefix}dalle id:(post ID)</code>`,
		`<code>${prefix}dalle id:e5832f798a41d335</code>`,
		"Looks up a specific post by its ID"
	]
});
