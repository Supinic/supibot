module.exports = {
	Name: "dalle",
	Aliases: [],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a new DALL-E image based on your prompt, or fetches one that was already made.",
	Flags: ["mention","non-nullable"],
	Params: [
		{ name: "id", type: "string" },
		{ name: "random", type: "boolean" },
		{ name: "search", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function dallE (context, ...args) {
		if (context.params.search || context.params.random || context.params.id) {
			const { id, random, search } = context.params;
			const image = await sb.Query.getRecordset(rs => rs
				.select("ID", "Prompt")
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

		const pending = require("./pending.js");
		const query = args.join(" ");
		if (!query) {
			return {
				success: false,
				reply: `No prompt provided! If you want to search for existing image sets, use the "search" parameter.`
			};
		}

		const pendingResult = pending.check(context.user, context.channel);
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

		const username = context.user.Name;
		const reply = (context.channel)
			? (message) => context.channel.send(message)
			: (message) => context.platform.pm(message, context.user);

		pending.set(context.user, context.channel);

		const notificationTimeout = setTimeout(() => {
			reply(sb.Utils.tag.trim `
				@${username},
				Seems like the API is working
				${waitingEmote} ${loadingEmote}
				The result should be coming up anywhere between two to five minutes or so.
			`);
		}, 2000);

		const start = process.hrtime.bigint();
		const response = await sb.Got("FakeAgent", {
			url: "https://bf.dallemini.ai/generate",
			method: "POST",
			responseType: "json",
			headers: {
				Referer: "https://hf.space/"
			},
			json: {
				prompt: query
			},
			timeout: 300_000,
			throwHttpErrors: false
		});

		pending.unset(context.user, context.channel);

		const nanoExecutionTime = process.hrtime.bigint() - start;
		if (response.statusCode === 503) {
			pending.setOverloaded();
			clearTimeout(notificationTimeout);

			return {
				success: false,
				reply: `The service is currently overloaded! Try again later.`
			};
		}

		const { images } = response.body;
		const hash = require("crypto").createHash("sha512");
		for (const base64Image of images) {
			hash.update(base64Image);
		}

		const jsonImageData = images.map(i => i.replace(/\\n/g, ""));
		const row = await sb.Query.getRow("data", "DALL-E");
		row.setValues({
			ID: hash.digest().toString("hex").slice(0, 16),
			User_Alias: context.user.ID,
			Channel: context.channel?.ID ?? null,
			Prompt: query,
			Created: new sb.Date(),
			Creation_Time: (Number(nanoExecutionTime) / 1e9),
			Data: JSON.stringify(jsonImageData)
		});

		await row.save({ skipLoad: false });

		const { ID } = row.values;
		return {
			cooldown: {
				user: context.user.ID,
				command: this.Name,
				channel: null,
				length: 60_000
			},
			reply: `https://supinic.com/data/dall-e/detail/${ID} DALL-E image set for prompt "${query}"`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Creates a DALL-E AI generated image, based on your prompt.",
		"Alternatively, searches for an existing prompt someone else has created.",
		"",

		`<code>${prefix}dalle (your prompt here)</code>`,
		`<code>${prefix}dalle Billy Herrington as president of the United States</code>`,
		"Creates a set of nine pictures with your prompt, and posts a link to it in the chat.",
		"Warning: This creation can take up to 2-5 minutes, so be patient. When the image is being generated, you cannot use any other commands until it finishes.",
		"Even still, the generation service can be overloaded at times (usually in the evening EU time), in which case you'll have to try again later.",
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
