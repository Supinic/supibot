const { uploadToImgur } = require("../../utils/command-utils.js");

module.exports = {
	Name: "query",
	Aliases: ["wolframalpha", "wa"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Wolfram Alpha query for any kind of information, or computation.",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: [
		{ name: "imageSummary", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function query (context, ...args) {
		if (!process.env.API_WOLFRAM_ALPHA_APPID) {
			throw new sb.Error({
				message: "No Wolfram Alpha AppID configured (API_WOLFRAM_ALPHA_APPID)"
			});
		}

		if (args.length === 0) {
			return {
				reply: "No query provided!",
				cooldown: { length: 2500 }
			};
		}

		if (context.params.imageSummary) {
			const response = await sb.Got.get("GenericAPI")({
				url: "http://api.wolframalpha.com/v1/simple",
				throwHttpErrors: false,
				responseType: "buffer",
				searchParams: {
					appid: process.env.API_WOLFRAM_ALPHA_APPID,
					i: args.join(" "),
					width: 500,
					units: "metric",
					background: "193555",
					foreground: "white",
					layout: "labelbar"
				}
			});

			if (response.statusCode !== 200) {
				return {
					success: false,
					reply: response.body.toString()
				};
			}

			const uploadResult = await uploadToImgur(response.body);
			if (!uploadResult.link) {
				return {
					success: false,
					reply: `Could not upload the image summary!`
				};
			}

			return {
				reply: `Image summary: ${uploadResult.link}`
			};
		}
		else {
			const response = await sb.Got.get("GenericAPI")({
				url: "http://api.wolframalpha.com/v1/result",
				throwHttpErrors: false,
				responseType: "text",
				searchParams: {
					appid: process.env.API_WOLFRAM_ALPHA_APPID,
					i: args.join(" ")
				}
			});

			return {
				reply: (context.platform.Name === "discord")
					? `\`${response.body}\``
					: response.body
			};
		}
	}),
	Dynamic_Description: (async (prefix) => [
		"Asks WolframAlpha for the response for a given question or query.",
		"",

		`<code>${prefix}query (your query here)</code>`,
		`<code>${prefix}query population of Austria</code>`,
		`Retrieves a simple response to your query.`,
		"",

		`<code>${prefix}query (your query here) <u>imageSummary:true</u></code>`,
		`<code>${prefix}query past presidents of India <u>imageSummary:true</u></code>`,
		`Retrieves and uploads an image with a summary of the response to your query.`
	])
};
