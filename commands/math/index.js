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

		const response = await sb.Got("GenericAPI", {
			method: "POST",
			responseType: "json",
			url: "https://api.mathjs.org/v4",
			json: {
				expr: args.join(" ")
			}
		});

		if (response.body.error) {
			return {
				success: false,
				reply: `Math failed: ${response.body.error}`
			};
		}
		else {
			return {
				reply: response.body.result
			};
		}
	}),
	Dynamic_Description: (async (prefix) => [
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
	])
};
