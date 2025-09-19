import createEmbeds from "./discord-embed.js";

export default {
	Name: "dalle",
	Aliases: [],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Creates a new DALL-E image based on your prompt, or links an already made one, using the search parameter.",
	Flags: ["mention"],
	Params: [
		{ name: "id", type: "string" }
	],
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
		const image = await core.Query.getRecordset(rs => rs
			.select("ID", "Prompt", "Created", "Creation_Time")
			.from("data", "DALL-E")
			.orderBy("RAND()")
			.where(
				{ condition: Boolean(id) },
				"ID = %s",
				id
			)
			.where(
				{ condition: (!id && !isRandom && search) },
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

		const discordData = {};
		if (context.channel && context.platform.Name === "discord") {
			const discordChannel = context.platform.client.channels.fetch(context.channel.Name);
			if (discordChannel && discordChannel.members && discordChannel.members.size <= 1000) {
				discordData.embeds = createEmbeds(image.ID, {
					prompt: image.Prompt,
					created: image.Created,
					creationTime: image.Creation_Time
				});
			}
		}

		return {
			reply: `https://supinic.com/data/dall-e/detail/${image.ID} DALL-E image set for "${image.Prompt}"`,
			discord: discordData
		};
	}),
	Dynamic_Description: (async (prefix) => [
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
	])
};
