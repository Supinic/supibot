import { types, upgrade } from "./definition.js";

export default {
	Name: "reload",
	Aliases: null,
	Author: "supinic",
	Cooldown: 0,
	Description: "Reloads a database definition or hotloads an updated script",
	Flags: ["pipe","skip-banphrase","system","whitelist"],
	Params: [
		{ name: "skipUpgrade", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function reload (context, command, ...rest) {
		const item = types.find(i => i.names.includes(command));
		if (!item) {
			return {
				success: false,
				reply: `Provided type cannot be reloaded!`
			};
		}

		const module = sb[item.target];
		if (item.executionType === "upgrade") {
			const isPlural = (item.plural.includes(command));

			return await upgrade(context, module, item.dir ?? item.name, isPlural, ...rest);
		}
		else if (typeof item.execution === "function") {
			return await item.execution(context, command, ...rest);
		}

		if (command.endsWith("s")) {
			await module.reloadData();
			return {
				reply: `Reloaded the sb.${item.target} module completely.`
			};
		}
		else {
			if (!module.hasReloadSpecific()) {
				return {
					success: false,
					reply: `This module does not support reloading a specific item!`
				};
			}

			const result = await module.reloadSpecific(...rest);
			if (result === false) {
				return {
					success: false,
					reply: `No ${item.target}s reloaded!`
				};
			}

			return {
				reply: `Reloaded ${rest.length} specific sb.${item.target}(s) successfully.`
			};
		}
	}),
	Dynamic_Description: null
};
