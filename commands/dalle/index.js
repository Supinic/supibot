import { createHash } from "node:crypto";
import createEmbeds from "./discord-embed.js";
import Pending from "./pending.js";

export default {
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
	]),
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
		}

		const query = args.join(" ");
		if (!query) {
			return {
				success: false,
				reply: `No prompt provided! Check the list of images here: https://supinic.com/data/dall-e/list`
			};
		}

		const pendingResult = Pending.check(context.user, context.channel);
		if (!pendingResult.success) {
			return pendingResult;
		}

		const [waitingEmote, loadingEmote] = await Promise.all([
			context.getBestAvailableEmote(
				["PauseChamp", "pajaPause", "CoolStoryBob", "GivePLZ"],
				"😴",
				{ shuffle: true }
			),
			context.getBestAvailableEmote(
				["ppCircle", "supiniLoading", "dankCircle", "ppAutismo", "pajaAAAAAAAAAAA"],
				"⌛",
				{ shuffle: true }
			)
		]);

		const mentionUsername = (context.getMentionStatus())
			? `${context.user.Name},`
			: "";

		Pending.set(context.user, context.channel);

		const notificationTimeout = setTimeout(async (timeoutContext) => {
			await timeoutContext.sendIntermediateMessage(sb.Utils.tag.trim `
				${mentionUsername}
				Processing...
				${waitingEmote} ${loadingEmote}
				Please wait up to 5 minutes.
			`);
		}, 2000, context);

		const start = process.hrtime.bigint();
		const response = await sb.Got.get("FakeAgent")({
			url: "https://bf.dallemini.ai/generate",
			method: "POST",
			responseType: "json",
			headers: {
				Referer: "https://hf.space/"
			},
			json: {
				prompt: query
			},
			timeout: {
				request: 300_000
			},
			throwHttpErrors: false
		});

		Pending.unset(context.user, context.channel);

		const nanoExecutionTime = process.hrtime.bigint() - start;
		if (response.statusCode !== 200) {
			clearTimeout(notificationTimeout);

			if (response.statusCode === 429 || response.statusCode === 503) {
				Pending.setOverloaded();
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

		const { images } = response.body;
		const hash = createHash("sha512");
		for (const base64Image of images) {
			hash.update(base64Image);
		}

		const jsonImageData = images.map(i => i.replaceAll("\n", ""));
		const row = await sb.Query.getRow("data", "DALL-E");
		const ID = hash.digest().toString("hex").slice(0, 16);
		const created = new sb.Date();
		const creationTime = (Number(nanoExecutionTime) / 1e9);

		row.setValues({
			ID,
			User_Alias: context.user.ID,
			Channel: context.channel?.ID ?? null,
			Prompt: query,
			Created: created,
			Creation_Time: creationTime,
			Data: JSON.stringify(jsonImageData)
		});

		await row.save({ skipLoad: true });

		const discordData = {};
		if (context.platform.Name === "discord") {
			discordData.embeds = createEmbeds(ID, {
				prompt: query,
				created,
				creationTime
			});
		}

		return {
			cooldown: {
				user: context.user.ID,
				command: this.Name,
				channel: null,
				length: 60_000
			},
			discord: discordData,
			reply: `https://supinic.com/data/dall-e/detail/${ID} DALL-E image set for prompt "${query}"`,
			removeEmbeds: true
		};
	})
};
