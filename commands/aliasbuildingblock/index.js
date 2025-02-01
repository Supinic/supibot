import blocks from "./blocks/index.js";

export default {
	Name: "aliasbuildingblock",
	Aliases: ["abb"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "A collection of smaller commands, only usable within aliases - and not as standalone commands. Consider these \"building blocks\" for more complex aliases, without needing to make them yourself.",
	Flags: ["external-input","pipe","skip-banphrase"],
	Params: [
		{ name: "amount", type: "number" },
		{ name: "em", type: "string" },
		{ name: "errorMessage", type: "string" },
		{ name: "excludeSelf", type: "boolean" },
		{ name: "limit", type: "number" },
		{ name: "regex", type: "regex" },
		{ name: "replacement", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function aliasBuildingBlock (context, type, ...args) {
		if (!context.append.alias && !context.append.pipe) {
			if (!type) {
				return {
					success: false,
					reply: `This command can only be used within aliases or pipes! Check help here: ${this.getDetailURL()}`
				};
			}

			type = type.toLowerCase();
			const block = blocks.find(i => i.name === type || i.aliases.includes(type));
			if (!block) {
				return {
					success: false,
					reply: `This command can only be used within aliases or pipes! Check help here: ${this.getDetailURL()}`
				};
			}
			else {
				return {
					success: false,
					reply: `This command can only be used within aliases or pipes! Block description: ${block.description}`
				};
			}
		}

		if (!type) {
			return {
				success: false,
				reply: `No block type provided! Check help here: ${this.getDetailURL()}`
			};
		}

		type = type.toLowerCase();
		const block = blocks.find(i => i.name === type || i.aliases.includes(type));
		if (!block) {
			return {
				success: false,
				reply: `Incorrect block type provided! Check help here: ${this.getDetailURL()}`
			};
		}

		const result = await block.execute(context, ...args);
		return {
			cooldown: result.cooldown ?? null,
			...result
		};
	}),
	Dynamic_Description: (async function (prefix) {
		const list = blocks.map(i => {
			const aliases = (i.aliases.length > 0)
				? `(${i.aliases.join(", ")})`
				: "";

			const examples = (i.examples.length > 0)
				? `<br><ul>${i.examples.map(j => `<li><code>${j[0]}</code> ➡ <code>${j[1]}</code></li>`).join("")}</ul>`
				: "";

			return `<li><code>${i.name}${aliases}</code><br>${i.description}${examples}</li>`;
		});

		return [
			"This is a collection of smaller, simpler commands that are only usable within user-made aliases.",
			"These serve as a simplification of commonly used aliases, to make your life easier when making new aliases.",
			"",

			`<code>${prefix}abb (type)</code>`,
			`<code>${prefix}aliasbuildingblock (type)</code>`,
			"For a given block type, executes a small command to be used in the alias.",

			"Blocks:",
			`<ul>${list.join("")}</ul>`
		];
	})
};
