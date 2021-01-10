module.exports = {
	Name: "github",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts GitHub repository links for Supibot and the website. If you add anything afterwards, a search will be executed for your query on the bot repository.",
	Flags: ["developer","mention","non-nullable","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function github (context, ...args) { 
		const query = args.join("");
		if (!query) {
			return {
				reply: sb.Utils.tag.trim `
					Supibot: https://github.com/Supinic/supibot 
					// Website: https://github.com/Supinic/supinic.com
					// Modules: https://github.com/Supinic/supi-core
					// SPM: https://github.com/Supinic/supibot-package-manager
				`
			};
		}
	
		const { items } = await sb.Got("GitHub", {
			url: `search/code?q=${query}+in:file+repo:supinic/supi-core+repo:supinic/supibot+repo:supinic/supibot-package-manager`
		}).json();
	
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
	Dynamic_Description: (async (prefix) => {
		return [
			"If nothing is specified, posts GitHub repo links; otherwise, will execute a search on Supibot's repositories.",
			"",
	
			`<code>${prefix}github</code>`,
			"Supibot: https://github.com/Supinic/supibot - Website: https://github.com/Supinic/supinic.com",
			"",
	
			`<code>${prefix}github (search query)</code>`,
			"Searches supibot's repositories for that query",
		];
	})
};