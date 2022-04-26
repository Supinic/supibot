module.exports = {
	Name: "math",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Does math. For more info, check the documentation for math.js",
	Flags: ["external-input","mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "fixed", type: "boolean" },
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

		if (context.params.fixed !== false) {
			parameters.expr = `format((${parameters.expr}), { notation: "fixed" })`;
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
			let reply = response.body.result;
			if (context.params.fixed !== false) {
				reply = reply.replace(/(^")|("$)/g, "");
			}

			return {
				reply
			};
		}
	}),
	Dynamic_Description: (async (prefix) => [
		"Calculates advanced maths. You can use functions, derivatives, integrals, methods, ...",
		`Look here for more info: <a href="https://mathjs.org/">mathjs documentation</a>`,
		"",

		"Simple math:",
		`<code>${prefix}math 1+1</code>`,
		"2",
		"",

		"Conversions between units:",
		`<code>${prefix}math 100 inches to cm</code>`,
		"254 cm",
		"",

		"Precision:",
		"When <code>precision</code> parameter is provided, the result will be trimmed to keep that many precision digits in.",
		`<code>${prefix}math (expression) <u>precision:(number)</u></code>`,
		`<code>${prefix}math 1/3 precision:2</code> => 0.33`,
		`<code>${prefix}math 2/3 precision:6</code> => 0.666666`,
		"",

		"Fixed notation:",
		"When <code>fixed:false</code> is provided, the result use the default exponential notation.",
		`<code>${prefix}math (expression) <u>fixed:false</u></code>`,
		`<code>${prefix}math 1000 * 1000 fixed:true</code> => 1000000`,
		`<code>${prefix}math 1000 * 1000 fixed:false</code> => 1e+6`
	])
};
