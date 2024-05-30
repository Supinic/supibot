const { categories } = require("./categories.json");

module.exports = {
	Name: "russianarmylosses",
	Aliases: ["ral"],
	Author: "boring_nick",
	Cooldown: 15000,
	Description: "Fetches the latest losses of the Russian Army in Ukraine, as provided by the General Staff of Ukraine.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function russianArmyLosses (context, ...args) {
		const response = await sb.Got("GenericAPI", {
			url: "https://russianwarship.rip/api/v1/statistics/latest"
		});

		let reply;
		const { increase, stats } = response.body.data;
		const inputTerm = args.join(" ").toLowerCase();

		if (inputTerm) {
			const category = categories.find(category => {
				const aliases = category.aliases.map(i => i.toLowerCase());
				return (category.name.toLowerCase() === inputTerm || aliases.includes(inputTerm));
			});

			if (!category) {
				return {
					success: false,
					reply: "Invalid category term has been provided! Check the command's extended help for a full list."
				};
			}

			reply = `Latest Russian Army losses for ${category.name}, as claimed by Ukraine: ${stats[category.code]}`;

			const statsIncrease = increase[category.code];
			if (statsIncrease !== 0) {
				reply += ` (+${statsIncrease})`;
			}
		}
		else {
			const replyParts = Object.keys(stats).map(key => {
				const category = categories.find(i => i.code === key);
				const term = (category) ? category.name : key; // In case of a newly added term, use the key as a fallback

				let string = `${term}: ${stats[key]}`;
				if (increase[key] !== 0) {
					string += ` (+${increase[key]})`;
				}

				return string;
			});

			reply = `Latest Russian Army losses, as claimed by Ukraine: ${replyParts.join(", ")}`;
		}

		return {
			reply
		};
	}),
	Dynamic_Description: (async function (prefix) {
		const categoriesList = categories.map(category => {
			const aliasList = category.aliases.map(i => `<code>${i}</code>`).join("");
			const aliasString = (aliasList) ? ` - aliases: ${aliasList}` : "";
			return `<li>${category.name}${aliasString}</li>`;
		});

		return [
			"Fetches the latest losses of the Russian Army in Ukraine during the Russian invasion of Ukraine started in 2022.",
			`The data is shown as provided by <a href="https://www.zsu.gov.ua/en">Armed Forces of Ukraine</a> and the <a href="https://www.mil.gov.ua/en/">Ministry of Defence of Ukraine</a>.`,
			"",

			`<code>${prefix}russianarmylosses</code>`,
			`<code>${prefix}ral</code>`,
			"Fetches the summary of all personnel and equipment losses, categorized into groups.",
			"Also includes the daily increase, if it has been reported.",
			"",

			`<code>${prefix}ral (category)</code>`,
			"Fetches the personnel or equipment losses for a provided category.",
			"Also includes the daily increase, if it has been reported.",
			"",

			"Supported categories:",
			`<ul>${categoriesList}</ul>`
		];
	})
};
