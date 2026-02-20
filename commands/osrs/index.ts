import { declare, type SubcommandDefinition } from "../../classes/command.js";
import { OsrsSubcommands } from "./subcommands/index.js";

import gameData from "./subcommands/game-data.json" with { type: "json" };
const { activities, activityAliases, skills } = gameData;

export type OsrsSubcommandDefinition = SubcommandDefinition<typeof osrsCommandDefinition>

const osrsCommandDefinition = declare({
	Name: "osrs",
	Aliases: null,
	Cooldown: 5000,
	Description: "Aggregate command for anything regarding Old School Runescape.",
	Flags: ["mention", "non-nullable", "pipe"],
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
	Code: (async function osrs (context, first, ...args) {
		const input = (first) ? first.toLowerCase() : "";
		let subcommand = OsrsSubcommands.get(input);
		if (!subcommand) {
			args.unshift(first);
			subcommand = OsrsSubcommands.default;
		}

		return await subcommand.execute.call(this, context, ...args);
	}),
	Dynamic_Description: async function (prefix) {
		const subcommandsDescription = await OsrsSubcommands.createDescription();

		const aliases: { activity: string; alias: string; }[] = [];
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
			.map(i => `<li>${core.Utils.capitalize(i.name)} - ${i.emoji}</li>`)
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
	}
});

export default osrsCommandDefinition;
