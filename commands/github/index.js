export default {
	Name: "github",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts GitHub repository links for Supibot and the website. If you add anything afterwards, a search will be executed for your query on the bot repository.",
	Flags: ["developer","mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function github (context, ...args) {
		const query = args.join("");
		if (!query) {
			return {
				reply: sb.Utils.tag.trim `
					Supibot: https://github.com/Supinic/supibot 
					// Website: https://github.com/Supinic/supinic.com
					// Modules: https://github.com/Supinic/supi-core
				`
			};
		}

		const encodedQuery = encodeURIComponent(query);
		const response = await sb.Got.get("GitHub")({
			url: `search/code?q=${encodedQuery}+in:file+repo:supinic/supi-core+repo:supinic/supibot`
		});

		const { items } = response.body;
		const filtered = items.filter(i => i.name.endsWith(".js"));
		if (filtered.length === 0) {
			return {
				success: false,
				reply: "No search results found!"
			};
		}

		const file = filtered.shift();
		const link = `https://github.com/${file.repository.full_name}/blob/master/${file.path}`;
		return {
			reply: `${file.name} - check here: ${link}`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"If nothing is specified, posts GitHub repo links; otherwise, will execute a search on Supibot's repositories.",
		"",

		`<code>${prefix}github</code>`,
		"Supibot: https://github.com/Supinic/supibot - Website: https://github.com/Supinic/supinic.com",
		"",

		`<code>${prefix}github <u>(search query)</u></code>`,
		`<code>${prefix}github <u>github</u></code>`,
		"Searches supibot's repositories for that query"
	])
};
