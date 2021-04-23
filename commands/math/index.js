module.exports = {
	Name: "math",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Does math. For more info, check the documentation for math.js",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function math (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No input provided!"
			};
		}
	
		const { statusCode, body: data } = await sb.Got("Leppunen", {
			url: "math",
			throwHttpErrors: false,
			searchParams: new sb.URLParams()
				.set("expr", args.join(" "))
				.toString()
		});
	
		if (statusCode === 200 || statusCode === 503) {
			return {
				reply: (context.platform.Name === "discord")
					? `\`${data.response}\``
					: data.response
			};
		}
		else {
			if (statusCode >= 500) {
				await sb.Platform.get("twitch").pm(
					`Math command failed - server error ${statusCode} at ${sb.Date.now()}! monkaS`,
					"leppunen"
				);
			}
	
			return {
				success: false,
				reply: `Math command failed due to request error ${statusCode}!`
			};
		}
	}),
	Dynamic_Description: (async (prefix) => {
		return [
			"Calculates advanced maths. You can use functions, derivatives, integrals, methods, ...",
			`Look here for more info: <a href="https://mathjs.org/">mathjs documentation</a>`,
			"",
			
			`<code>${prefix}math 1+1</code>`,
			"2",
			"",
	
			`<code>${prefix}math e^(i*pi)</code>`,
			"-1 + 1.2246467991473532e-16i",
			"",
	
			`<code>${prefix}math 100 inches to cm</code>`,
			"254 cm",
			""
		];
	})
};