module.exports = {
	Name: "dalle",
	Aliases: [],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Creates a new DALL-E image based on your prompt, or fetches one that was already made.",
	Flags: ["mention","non-nullable","pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function dallE (context, ...args) {
		const query = args.join(" ");
		if (!query) {
			return {
				success: false,
				reply: `Checking existing images is currently not supported!`
			};
		}

		const notificationTimeout = setTimeout(() => {
			context.channel?.send("Seems like it's working PauseChamp ppCircle see you in two to five minutes or so");
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

		const nanoExecutionTime = process.hrtime.bigint() - start;
		if (response.statusCode === 503) {
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
			reply: `Your DALL-E image: https://supinic.com/data/dall-e/detail/${ID}`
		};
	}),
	Dynamic_Description: null
};
