module.exports = {
	Name: "math",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Does math. For more info, check the documentation for math.js",
	Flags: ["external-input","mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "precision", type: "number" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function math (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No input provided!"
			};
		}

		const parameters = {
			expr: args.join(" ")
		};

		if (context.params.precision) {
			if (!sb.Utils.isValidInteger(context.params.precision)) {
				return {
					success: false,
					reply: "Provided precision must be a positive integer!"
				};
			}

			parameters.precision = context.params.precision;
		}

		const response = await sb.Got("GenericAPI", {
			method: "POST",
			responseType: "json",
			throwHttpErrors: false,
			url: "https://api.mathjs.org/v4",
			json: parameters
		});

		if (response.body.error) {
			return {
				success: false,
				reply: `${response.body.error}`
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
