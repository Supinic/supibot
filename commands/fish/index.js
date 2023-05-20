module.exports = {
	Name: "fish",
	Aliases: [],
	Author: [
		"techno_______ (2547techno)",
		"brin____ (brian6932)",
		"futurecreep",
		"chusnek",
		"supinic"
	],
	Cooldown: 5000,
	Description: "Go fishing! Supports multiple subcommands - check those out in the full command description.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function fish (context, ...args) {
		const { subcommands } = require("./subcommands/index.js");
		const [subcommandName, ...rest] = args;

		const subcommand = subcommands.find(i => i.name === subcommandName || i.aliases.includes(subcommandName));
		if (subcommand) {
			return await subcommand.execute(context, ...rest);
		}
		else {
			const defaultSubcommand = subcommands.find(i => i.default);
			return await defaultSubcommand.execute(context, subcommandName, ...rest);
		}
	}),
	Dynamic_Description: (async function () {
		const { subcommands } = require("./subcommands/index.js");
		const subcommandsDescription = subcommands.flatMap(i => [
			`<h5>${i.name}</h5>`,
			...i.description,
			""
		]);

		return [
			"Go fishing!",
			"",

			...subcommandsDescription,
			"",

			"This command only exists as a collaborative effort of the following amazing people:",
			sb.Utils.tag.trim `
				<ul>
					<li><code>techno_______ (2547techno)</code></li> 
						Original alias creator. Basically re-created a StreamElements command within Supibot.
					    Full story: https://i.imgur.com/6ubSZHV.png
					<li><code>brin____ (brian6932)</code></li> 
						Code cleanup and addition of basic features.
					<li><code>futurecreep</code></li> 
						Added bait and cooldowns to prevent abuse.
					<li><code>chusnek</code></li>
					    Added GPT interaction to create stories when you catch a fish.
				</ul>
			`
		];
	})
};
