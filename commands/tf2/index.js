const weapons = require("./weapons.json");

// This definitely has to be turned into a standard subcommand structure once it gets expanded
// I'm only leaving the definition like this because $tf2 only has one subcommand (for now).
const SUBCOMMAND_NAMES = ["roll"].join(", ");
const TEAM_FORTRESS_CLASSES = ["Scout", "Pyro", "Soldier", "Heavy", "Demoman", "Medic", "Spy", "Engineer", "Sniper"];

module.exports = {
	Name: "tf2",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Aggregate command for everything related to Team Fortress 2.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function teamFortress2 (context, subcommand, ...args) {
		if (!subcommand) {
			return {
				success: false,
				reply: `No subcommand provided! Use one of: ${SUBCOMMAND_NAMES}`
			};
		}

		switch (subcommand.toLowerCase()) {
			case "roll": {
				const lowercaseClasses = TEAM_FORTRESS_CLASSES.map(i => i.toLowerCase());
				const playerClass = (lowercaseClasses.includes(args[0]?.toLowerCase()))
					? sb.Utils.capitalize(args[0])
					: sb.Utils.randArray(TEAM_FORTRESS_CLASSES);

				const classWeapons = weapons.filter(i => i.classes.includes(playerClass));

				const primary = sb.Utils.randArray(classWeapons.filter(i => i.slot === "primary"));
				const secondary = sb.Utils.randArray(classWeapons.filter(i => i.slot === "secondary"));
				const melee = sb.Utils.randArray(classWeapons.filter(i => i.slot === "melee"));

				const loadout = [primary.name, secondary.name, melee.name];
				if (playerClass === "Spy") {
					const watch = sb.Utils.randArray(classWeapons.filter(i => i.slot === "watch"));
					loadout.push(watch.name);
				}

				return {
					reply: sb.Utils.tag.trim `
						Your random ${playerClass} loadout is:
						${loadout.join(", ")}
					`
				};
			}

			default: {
				return {
					success: false,
					reply: `Invalid subcommand provided! Use one of: ${SUBCOMMAND_NAMES}`
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
