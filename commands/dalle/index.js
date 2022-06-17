module.exports = {
	Name: "dalle",
	Aliases: [],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a new DALL-E image based on your prompt, or fetches one that was already made.",
	Flags: ["mention","non-nullable"],
	Params: [
		{ name: "search", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function dallE (context, ...args) {
		if (context.params.search) {
			const { search } = context.params;
			const image = await sb.Query.getRecordset(rs => rs
				.select("ID", "Prompt")
				.from("data", "DALL-E")
				.orderBy("RAND()")
				.where(
					{ condition: Boolean(search) },
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
				reply: `Random DALL-E image set for "${image.Prompt}": https://supinic.com/data/dall-e/detail/${image.ID}`
			};
		}
		else if (context.append.pipe) {
			return {
				success: false,
				reply: `Piping input into this command in order to create a prompt is not allowed!`
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

		const reply = (context.channel)
			? (message) => context.channel.send(message)
			: (message) => context.platform.pm(message, context.user);

		pending.set(context.user, context.channel);

		const notificationTimeout = setTimeout(() => {
			reply(sb.Utils.tag.trim `
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
			reply: `Your DALL-E image set: https://supinic.com/data/dall-e/detail/${ID}`
		};
	}),
	Dynamic_Description: null
};
