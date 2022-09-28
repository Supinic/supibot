module.exports = {
	Name: "randompastebin",
	Aliases: ["rpb"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a random recently posted programming-related Pastebin paste.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "linkOnly", type: "boolean" },
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
	Code: (async function randomPastebin (context, syntax) {
		let data = await sb.Cache.getByPrefix("random-pastebin-paste-list");
		if (!data) {
			const response = await sb.Got("GenericAPI", {
				url: "https://scrape.pastebin.com/api_scraping.php",
				responseType: "json",
				searchParams: {
					limit: "100"
				}
			});

			data = response.body.map(i => ({
				key: i.key,
				title: (i.title === "") ? null : i.title,
				posted: new sb.Date(i.date * 1000),
				expires: (i.expire === "0") ? null : new sb.Date(i.expire * 1000),
				user: (i.user === "") ? null : i.user,
				syntax: i.syntax,
				size: Number(i.size)
			}));

			await sb.Cache.setByPrefix("random-pastebin-paste-list", data, {
				expiry: 300_000
			});
		}

		if (syntax === "list") {
			const list = [...new Set(data.map(i => i.syntax))].sort();
			return {
				cooldown: 2500,
				reply: `List of currently available languages: ${list.join(", ")}`
			};
		}

		let filteredData = data;
		if (context.params.syntax) {
			const syntaxList = context.params.syntax.split(/\W+/).filter(Boolean);
			filteredData = data.filter(i => syntaxList.includes(i.syntax.toLowerCase()));
		}
		else if (syntax) {
			filteredData = data.filter(i => i.syntax.toLowerCase() === syntax.toLowerCase());
		}

		const paste = sb.Utils.randArray(filteredData);
		if (!paste) {
			const list = [...new Set(data.map(i => i.syntax))].sort();
			return {
				success: false,
				cooldown: 2500,
				reply: `Could not find any pastes matching your search! Currently available languages: ${list.join(", ")}`
			};
		}

		if (context.params.linkOnly) {
			return {
				reply: `https://pastebin.com/${paste.key}`
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
	Dynamic_Description: (async (prefix) => {
		const { languages } = this.staticData;
		const data = await sb.Cache.getByPrefix("random-pastebin-paste-list");

		let list;
		let listDescription;
		if (data && data.length !== 0) {
			const uniques = new Set(data.map(i => i.syntax));
			list = [...uniques]
				.filter(Boolean)
				.sort()
				.map(i => `<li>${i}</li>`)
				.join("");

			listDescription = "Currently available languages:";
		}
		else {
			list = languages.map(i => `<li>${i}</li>`).join("");
			listDescription = "Common language list (<a href=\"//pastebin.com/languages\">full list</a>):";
		}

		return [
			"Fetches a random programming related paste, posted recently (up to ~1 hour old).",
			"You can use a language identifier to pick a random paste that uses just that language.",
			"",

			`<code>${prefix}randompastebin</code>`,
			`<code>${prefix}rpb</code>`,
			"Posts a summary of the paste.",
			"",

			`<code>${prefix}rpb (language)</code>`,
			`<code>${prefix}rpb syntax:(languages)</code>`,
			`<code>${prefix}rpb javascript</code>`,
			`<code>${prefix}rpb syntax:javascript</code>`,
			`<code>${prefix}rpb syntax:"c cpp csharp"</code>`,
			"Posts a summary of a paste, only using your provided programming language.",
			"",

			`<code>${prefix}rpb linkOnly:true</code>`,
			"Posts only the link of a given random paste, without the summary itself.",
			"",

			`<code>${prefix}rpb list</code>`,
			"Shows a list of currently available languages.",
			"",

			listDescription,
			`<ul>${list}</ul>`
		];
	})
};
