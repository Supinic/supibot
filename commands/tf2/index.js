module.exports = {
	Name: "tf2",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Aggregate command for everything related to Team Fortress 2.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		subcommands: ["roll"],
		classes: ["Scout", "Pyro", "Soldier", "Heavy", "Demoman", "Medic", "Spy", "Engineer", "Sniper"]
	})),
	Code: (async function teamFortress2 (context, subcommand, ...args) {
		if (!subcommand) {
			const subcommands = this.staticData.subcommands.join(", ");
			return {
				success: false,
				reply: `No subcommand provided! Use one of: ${subcommands}`
			};
		}

		switch (subcommand.toLowerCase()) {
			case "roll": {
				const classes = this.staticData.classes.map(i => i.toLowerCase());
				const playerClass = (classes.includes(args[0].toLowerCase()))
					? sb.Utils.capitalize(args[0])
					: sb.Utils.randArray(classes);

				const weapons = require("./weapons.json");
				const classWeapons = weapons.filter(i => i.classes.includes(playerClass));

				const primary = sb.Utils.randArray(classWeapons.filter(i => i.slot === "primary"));
				const secondary = sb.Utils.randArray(classWeapons.filter(i => i.slot === "secondary"));
				const melee = sb.Utils.randArray(classWeapons.filter(i => i.slot === "melee"));

				const loadout = [primary, secondary, melee];
				if (playerClass === "Spy") {
					const watch = sb.Utils.randArray(classWeapons.filter(i => i.slot === "watch"));
					loadout.push(watch);
				}

				return {
					reply: sb.Utils.tag.trim `
						Your random ${playerClass} loadout is:
						${loadout.join(", ")}
					`
				};
			}

			default: {
				const subcommands = this.staticData.subcommands.join(", ");
				return {
					success: false,
					reply: `Invalid subcommand provided! Use one of: ${subcommands}`
				};
			}
		}
	}),
	Dynamic_Description: (async (prefix) => [
		"Aggregate command for Team Fortress 2.",
		"",

		`<code>${prefix}tf2 roll</code>`,
		`<code>${prefix}tf2 roll pyro</code>`,
		"Rolls a random loadout, either for a random class or for the one you provide."
	])
};
