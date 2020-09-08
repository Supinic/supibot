module.exports = {
	Name: "math",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
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
	
		const { response, status } = await sb.Got.instances.Leppunen({
			url: "math",
			searchParams: new sb.URLParams()
				.set("expr", args.join(" "))
				.toString()
		}).json();
		
		if (status === 200 || status === 503) {
			const string = response.replace(/\bNaN\b/g, "NaM").replace(/\btrue\b/g, "TRUE LULW");
			return {
				reply: (context.platform.Name === "discord")
					? `\`${string}\``
					: string
			};
		}
		else {
			return {
				reply: "@Leppunen $math failed monkaS"
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