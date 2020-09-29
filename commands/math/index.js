module.exports = {
	Name: "math",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-28T23:55:03.000Z",
	Cooldown: 5000,
	Description: "Does math. For more info, check the documentation for math.js",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function math (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No input provided!"
			};
		}
	
		const { statusCode, body: data } = await sb.Got.instances.Leppunen({
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
			await sb.Platform.get("twitch").pm(
				`Math command failed - server error ${statusCode} at ${sb.Date.now()}! monkaS`,
				"leppunen"
			);
	
			return {
				success: false,
				reply: `Math command failed due to server error ${statusCode}!`
			};
		}
	}),
	Dynamic_Description: async (prefix) => {
		return [
			"Calculates advanced maths. You can use functions, derivatives, integrals, methods, ...",
			`Look here for more info: <a href="https://mathjs.org/">mathjs documentation</a>`,
			"",
			
			`<code>${prefix}math 1+1</code>`,
			"2",
			"",
	
			`<code>${prefix}math e^(i*pi)</code>`,
			"0",
			"",
	
			`<code>${prefix}math 100 inches to cm</code>`,
			"25.4 cm",
			""
		];
	}
};