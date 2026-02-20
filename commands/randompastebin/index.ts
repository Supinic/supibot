/* eslint-disable array-element-newline */
import * as z from "zod";
import { SupiDate } from "supi-core";
import { declare } from "../../classes/command.js";

const pastebinLanguages = [
	"apache", "arduino", "bash", "c", "cpp",
	"csharp", "css", "dart", "html4strict", "html5",
	"java", "javascript", "json", "kotlin", "lua",
	"make", "mysql", "nginx", "pascal", "php",
	"postgresql", "powershell", "python", "ruby", "sql",
	"stonescript", "swift", "typescript", "verilog", "xml",
	"yaml"
] as const;
const querySchema = z.array(z.object({
	date: z.string(),
	expire: z.string(),
	full_url: z.string(),
	key: z.string(),
	size: z.string(),
	syntax: z.string(),
	title: z.string(),
	user: z.string()
}));
type CachedPastebinItem = {
	key: string;
	title: string | null;
	user: string | null;
	posted: string;
	expires: string | null;
	syntax: string;
	size: number;
};

const fetchData = async () => {
	let data = await core.Cache.getByPrefix("random-pastebin-paste-list") as CachedPastebinItem[] | undefined;
	if (!data) {
		const response = await core.Got.get("GenericAPI")({
			url: "https://scrape.pastebin.com/api_scraping.php",
			responseType: "json",
			searchParams: {
				limit: "100"
			}
		});

		data = querySchema.parse(response.body).map(i => ({
			key: i.key,
			title: (i.title === "") ? null : i.title,
			posted: new SupiDate(Number(i.date) * 1000).toJSON(), // @todo if Cache supports SupiDate, remove the toJSON here
			expires: (i.expire === "0") ? null : new SupiDate(Number(i.expire) * 1000).toJSON(),
			user: (i.user === "") ? null : i.user,
			syntax: i.syntax,
			size: Number(i.size)
		}));

		await core.Cache.setByPrefix("random-pastebin-paste-list", data, {
			expiry: 300_000
		});
	}

	return data;
};

export default declare({
	Name: "randompastebin",
	Aliases: ["rpb"],
	Cooldown: 10000,
	Description: "Fetches a random recently posted Pastebin paste.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "linkOnly", type: "boolean" },
		{ name: "syntax", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function randomPastebin (context, syntax) {
		const data = await fetchData();
		if (syntax === "list") {
			const list = [...new Set(data.map(i => i.syntax))].sort();
			return {
				cooldown: 2500,
				reply: `List of currently available languages: ${list.join(", ")}`
			};
		}

		let filteredData = data;
		if (context.params.syntax) {
			const syntaxList = new Set(context.params.syntax.split(/\W+/).filter(Boolean));
			filteredData = data.filter(i => syntaxList.has(i.syntax.toLowerCase()));
		}
		else if (syntax) {
			filteredData = data.filter(i => i.syntax.toLowerCase() === syntax.toLowerCase());
		}

		if (filteredData.length === 0) {
			const list = [...new Set(data.map(i => i.syntax))].sort();
			return {
				success: false,
				cooldown: 2500,
				reply: `Could not find any pastes matching your search! Currently available languages: ${list.join(", ")}`
			};
		}

		const paste = core.Utils.randArray(filteredData);
		if (context.params.linkOnly) {
			return {
				success: true,
				reply: `https://pastebin.com/${paste.key}`
			};
		}

		const delta = core.Utils.timeDelta(new SupiDate(paste.posted));
		const expiryString = (paste.expires) ? `Expires ${core.Utils.timeDelta(new SupiDate(paste.expires))}.` : "";
		return {
			reply: core.Utils.tag.trim `
				Random ${paste.syntax} paste
				from ${paste.user ?? "anonymous"}
				(posted ${delta}): 
				https://pastebin.com/${paste.key}
				Size: ${paste.size} characters.
				${expiryString}
			`
		};
	}),
	Dynamic_Description: (async function (prefix) {
		const data = await fetchData();
		const uniques = new Set(data.map(i => i.syntax));

		const list = pastebinLanguages.map(lang => (
			(uniques.has(lang))
				? `<li><b>${lang}</b>`
				: `<li>${lang}</li>`
		));

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

			"Currently available languages:",
			`<ul>${list.join("")}</ul>`
		];
	})
});
