module.exports = {
	Name: "randompastebin",
	Aliases: ["rpb"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a random recently posted programming-related Pastebin paste.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "syntax", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		languages: [
			"apache",
			"arduino",
			"bash",
			"c",
			"cpp",
			"csharp",
			"css",
			"dart",
			"html4strict",
			"html5",
			"java",
			"javascript",
			"json",
			"kotlin",
			"lua",
			"make",
			"mysql",
			"nginx",
			"pascal",
			"php",
			"postgresql",
			"powershell",
			"python",
			"ruby",
			"sql",
			"stonescript",
			"swift",
			"typescript",
			"verilog",
			"xml",
			"yaml"
		]
	})),
	Code: (async function randomPastebin (context) {
		let data = await this.getCacheData("paste-list");
		if (!data) {
			const response = await sb.Got("GenericAPI", {
				url: "https://scrape.pastebin.com/api_scraping.php",
				responseType: "json",
				searchParams: {
					limit: "100"
				}
			});

			const list = response.body.map(i => ({
				key: i.key,
				title: (i.title === "") ? null : i.title,
				posted: new sb.Date(i.date * 1000),
				expires: (i.expire === "0") ? null : new sb.Date(i.expire * 1000),
				user: (i.user === "") ? null : i.user,
				syntax: i.syntax,
				size: Number(i.size)
			}));

			data = list;
			await this.setCacheData("paste-list", list, {
				expiry: 60_000
			});
		}

		if (context.params.syntax) {
			data = data.filter(i => i.syntax.toLowerCase() === context.params.syntax);
		}

		const paste = sb.Utils.randArray(data);
		if (!paste) {
			return {
				success: false,
				reply: `Could not find any pastes matching your search!`
			};
		}

		const delta = sb.Utils.timeDelta(new sb.Date(paste.posted));
		const expiryString = (paste.expires) ? `Expires ${sb.Utils.timeDelta(new sb.Date(paste.expires))}.` : "";
		return {
			reply: sb.Utils.tag.trim `
				Random ${paste.syntax} paste
				from ${paste.user ?? "anonymous"}
				(posted ${delta}): 
				https://pastebin.com/${paste.key}
				Size: ${paste.size} characters.
				${expiryString}
			`
		};
	}),
	Dynamic_Description: (async (prefix, values) => {
		const { languages } = values.getStaticData();
		const list = languages.map(i => `<li>${i}</li>`).join("");

		return [
			"Fetches a random programming related paste, posted recently (up to ~1 hour old).",
			"You can use a language identifier to pick a random paste that uses just that language.",
			"",

			`<code>${prefix}randompastebin</code>`,
			`<code>${prefix}rpb</code>`,
			"Posts a summary of the paste.",
			"",

			`<code>${prefix}rpb syntax:(language)</code>`,
			"Posts a summary of a paste, only using your provided programming language.",
			"",

			`Common language list (<a href="//pastebin.com/languages">full list</a>):`,
			`<ul>${list}</ul>`
		];
	})
};
