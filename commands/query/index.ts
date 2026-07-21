import { SupiError } from "supi-core";
import { declare } from "../../classes/command.js";

export default declare({
	Name: "query",
	Aliases: ["wolframalpha", "wa"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Wolfram Alpha query for any kind of information, or computation.",
	Flags: ["external-input", "mention", "non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function query (context, ...args) {
		if (!process.env.API_WOLFRAM_ALPHA_APPID) {
			throw new SupiError({
				message: "No Wolfram Alpha AppID configured (API_WOLFRAM_ALPHA_APPID)"
			});
		}

		if (args.length === 0) {
			return {
				success: false,
				reply: "No query provided!",
				cooldown: { length: 2500 }
			};
		}

		const response = await core.Got.get("GenericAPI")({
			url: "http://api.wolframalpha.com/v1/result",
			throwHttpErrors: false,
			responseType: "text",
			searchParams: {
				appid: process.env.API_WOLFRAM_ALPHA_APPID,
				i: args.join(" ")
			}
		});

		return {
			success: true,
			reply: (context.platform.Name === "discord")
				? `\`${response.body}\``
				: response.body
		};
	}),
	Dynamic_Description: (prefix) => [
		"Asks WolframAlpha for the response for a given question or query.",
		"",

		`<code>${prefix}query (your query here)</code>`,
		`<code>${prefix}query population of Austria</code>`,
		`Retrieves a simple response to your query.`,
		"",

		`<code>${prefix}query (your query here) <u>imageSummary:true</u></code>`,
		`<code>${prefix}query past presidents of India <u>imageSummary:true</u></code>`,
		`Retrieves and uploads an image with a summary of the response to your query.`
	]
});
