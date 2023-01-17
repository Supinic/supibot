module.exports = {
	Name: "osrs",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Aggregate command for whatever regarding Old School Runescape.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "activity", type: "string" },
		{ name: "boss", type: "string" },
		{ name: "force", type: "boolean" },
		{ name: "rude", type: "boolean" },
		{ name: "seasonal", type: "boolean" },
		{ name: "skill", type: "string" },
		{ name: "virtual", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function osrs (context, first, ...args) {
		if (!first) {
			return {
				success: false,
				reply: `Not enough arguments provided! Check the command help here: ${this.getDetailURL()}`
			};
		}

		const subcommands = require("./subcommands");
		const input = first.toLowerCase();

		let subcommand = subcommands.find(i => i.name === input || i.aliases.includes(input));
		if (!subcommand) {
			args.unshift(first);
			subcommand = subcommands.find(i => i.default === true);
		}

		return await subcommand.execute.call(this, context, ...args);
	}),
	Dynamic_Description: (async function (prefix) {
		const subcommands = require("./subcommands");
		const subcommandsDescription = subcommands.flatMap(i => [
			`<h6>${i.title}</h6>`,
			"",
			...i.description,
			""
		]);

		const { activities, activityAliases, skills } = require("./game-data.json");
		const aliases = [];
		for (const [key, value] of Object.entries(activityAliases)) {
			aliases.push({
				activity: value,
				alias: key
			});
		}

		const activityList = [...activities]
			.sort()
			.map(activity => {
				let alias = "";
				const specific = aliases.filter(i => activity === i.activity).map(i => i.alias);
				if (specific.length !== 0) {
					alias = ` - aliases: ${specific.join(", ")}`;
				}

				return `<li>${activity}${alias}</li>`;
			})
			.join("");

		const skillList = [...skills]
			.sort((a, b) => a.name.localeCompare(b.name))
			.map(i => `<li>${i.name} - ${i.emoji}</li>`)
			.join("");

		return [
			"Various utility commands all related to Old School Runescape.",
			"",

			...subcommandsDescription,

			"<u>Seasonal stats</u>",
			`<code>${prefix}osrs stats <u>seasonal:true</u> (username)</code>`,
			`<code>${prefix}osrs kc <u>seasonal:true</u> activity:(activity) (username)</code>`,
			`Works the same way as the respective commands, but uses the "seasonal" hiscores.`,
			"This usually refers to Leagues, or the Deadman Mode.",
			"",

			`<u>"Rude mode"</u>`,
			`<code>${prefix}osrs stats <u>rude:true</u> (username)</code>`,
			`<code>${prefix}osrs kc <u>rude:true</u> activity:(activity) (username)</code>`,
			`Works the same way as the respective command - but when used, the command will call out dead hardcore ironmen by calling them "ex-hardcore".`,
			"If set to false, or not set at all, it will just refer to them as regular ironmen.",
			"",

			"<u>Skills and used emojis</u>",
			`<ul>${skillList}</ul>`,
			"",

			"<h6>Supported activities</h6>",
			`<ul>${activityList}<ul>`
		];
	})
};
