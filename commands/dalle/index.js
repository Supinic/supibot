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
			timeout: 120_000,
			throwHttpErrors: false
		});

		const executionTime = process.hrtime.bigint() - start;
		if (response.statusCode === 503) {
			return {
				success: false,
				reply: `The service is currently overloaded! Try again later.`
			};
		}

		const { images } = response.body;
		const image = sb.Utils.randArray(images);
		const buffer = Buffer.from(image, "base64");

		const uploadData = await sb.Utils.uploadToImgur(buffer);
		if (!uploadData.link) {
			return {
				success: false,
				reply: `Image upload failed!`
			};
		}

		const imgurMatch = uploadData.link.match(/imgur\.com\/(\w+\.\w+)$/);
		const row = await sb.Query.getRow("data", "DALL-E");
		row.setValues({
			Imgur_ID: imgurMatch[1],
			User_Alias: context.user.ID,
			Created: new sb.Date(),
			Prompt: query,
			Creation_Time: executionTime
		});

		await row.save({ skipLoad: true });
		return {
			reply: `Your DALL-E image: ${uploadData.link}`
		};
	}),
	Dynamic_Description: null
};
