module.exports = {
	Name: "russianarmylosses",
	Aliases: ["ral"],
	Author: "boring_nick",
	Cooldown: 15000,
	Description: "Fetches the latest losses of the Russian Army in Ukraine, as provided by the General Staff of Ukraine.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		// While this data is provided by the API, some names are too long for chat and have been shortened.
		// Also, several aliases have been added for ease of use.
		// Ideally, each category should have a one-word name/alias - so that it is easy to use with just a single word.
		// https://russianwarship.rip/api-documentation/v1#/Terms/getAllStatisticalTerms
		categories: [
			{
				name: "Personnel",
				code: "personnel_units",
				aliases: ["Soldiers", "Units", "Personnel units"]
			},
			{
				name: "Tanks",
				code: "tanks",
				aliases: []
			},
			{
				name: "Armoured fighting vehicles",
				code: "armoured_fighting_vehicles",
				aliases: ["AFV", "AFVs", "Combat vehicles", "Fighting vehicles"]
			},
			{
				name: "Artillery",
				code: "artillery_systems",
				aliases: ["Artillery systems"]
			},
			{
				name: "MLRS",
				code: "mlrs",
				aliases: ["Multiple launch rocket systems"]
			},
			{
				name: "Anti-air systems",
				code: "aa_warfare_systems",
				aliases: ["AA", "Anti-air"]
			},
			{
				name: "Planes",
				code: "planes",
				aliases: []
			},
			{
				name: "Helicopters",
				code: "helicopters",
				aliases: []
			},
			{
				name: "Other vehicles and fuel tanks",
				code: "vehicles_fuel_tanks",
				aliases: ["Vehicles", "Other vehicles"]
			},
			{
				name: "Warships",
				code: "warships_cutters",
				aliases: ["Ships"]
			},
			{
				name: "Missiles",
				code: "cruise_missiles",
				aliases: ["Cruise missiles"]
			},
			{
				name: "UAV",
				code: "uav_systems",
				aliases: ["UAVs"]
			},
			{
				name: "Special equipment",
				code: "special_military_equip",
				aliases: ["Other equipment", "Other"]
			},
			{
				name: "Missile systems",
				code: "atgm_srbm_systems",
				aliases: ["ATGM", "SRBM"]
			}
		]
	})),
	Code: (async function russianArmyLosses (context, ...args) {
		const response = await sb.Got("GenericAPI", {
			url: "https://russianwarship.rip/api/v1/statistics/latest"
		});

		let reply;
		const { increase, stats } = response.body.data;
		const { categories } = this.staticData;
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

			reply = `Latest Russian Army losses for ${category.name}: ${stats[category.code]}`;

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

			reply = `Latest Russian Army losses: ${replyParts.join(", ")}`;
		}

		return {
			reply
		};
	}),
	Dynamic_Description: (prefix) => {
		const categoriesList = this.staticData.categories.map(category => {
			const aliasList = category.aliases.map(i => `<code>${i}</code>`).join(", ");
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
	}
};
