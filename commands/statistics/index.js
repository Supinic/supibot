module.exports = {
	Name: "statistics",
	Aliases: ["stat","stats"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts various statistics regarding you or other users, e.g. total afk time.",
	Flags: ["mention","pipe","use-params"],
	Params: [
		{ name: "recalculate", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function statistics (context, type, ...args) {
		if (!type) {
			return {
				reply: "No statistics type provided!",
				cooldown: {
					length: 2500
				}
			};
		}

		const loadDefinitions = await require("./statistics.js");
		const definitions = await loadDefinitions();

		type = type.toLowerCase();
		const target = definitions.find(i => i.name === type || i.aliases.includes(type));
		if (!target) {
			return {
				reply: "Unrecognized statistics type provided!",
				cooldown: {
					length: 2500
				}
			};
		}

		return await target.execute(context, type, ...args);
	}),
	Dynamic_Description: (async (prefix) => {
		const loadDefinitions = await require("./statistics.js");
		const definitions = await loadDefinitions();

		const list = definitions.map(i => {
			const names = [i.name, ...i.aliases].sort().map(j => `<code>${j}</code>`).join(" | ");
			return `${names}<br>${i.description}`;
		}).join("<br>");

		return [
			"Checks various statistics found around supibot's data, regarding you or a provided user - depending on the type used.",
			"",

			`<code>${prefix}stats (type)</code>`,
			"Statistics based on the type used",
			"",

			"Types:",
			`<ul>${list}</ul>`
		];
	})
};
