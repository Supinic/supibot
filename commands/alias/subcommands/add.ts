import { SupiDate } from "supi-core";
import { type AliasSubcommandDefinition, prefix } from "../index.js";

import {
	ALIAS_NAME_REGEX,
	ALIAS_INVALID_NAME_RESPONSE,
	parseCommandName,
	type AliasData,
	getAliasByNameAndUser
} from "../alias-utils.js";

export default {
	name: "add",
	title: "Item IDs",
	aliases: ["addedit", "create", "upsert"],
	default: false,
	description: [
		`<code>${prefix}alias add (name) (definition)</code>`,
		`<code>${prefix}alias create (name) (definition)</code>`,
		`Creates your command alias, e.g.:`,
		`<code>${prefix}alias add <u>hello</u> translate to:german Hello!</code>`
	],
	execute: async function (context, invocation, ...args) {
		const [name, command, ...rest] = args;
		if (!name || !command) {
			return {
				success: false,
				reply: `You didn't provide a name, or a command! Usage: alias add (name) (command) (...arguments)"`
			};
		}
		else if (!ALIAS_NAME_REGEX.test(name)) {
			return {
				success: false,
				reply: `Your alias name is not valid! ${ALIAS_INVALID_NAME_RESPONSE}`
			};
		}

		const alias = await getAliasByNameAndUser(name, context.user.ID);
		if (alias && (invocation === "add" || invocation === "create")) {
			return {
				success: false,
				reply: `Cannot ${invocation} alias "${name}" - you already have one! You can either "edit" its definition, "rename" it or "remove" it.`
			};
		}

		const commandCheck = parseCommandName(command);
		if (!commandCheck) {
			return {
				success: false,
				reply: `Cannot create alias! The command "${command}" does not exist.`
			};
		}

		const row = await core.Query.getRow<AliasData>("data", "Custom_Command_Alias");
		if (alias) {
			await row.load(alias.ID);
		}

		row.setValues({
			User_Alias: context.user.ID,
			Channel: null,
			Name: name,
			Command: commandCheck.Name,
			Invocation: command,
			Arguments: (rest.length > 0) ? JSON.stringify(rest) : null,
			Created: new SupiDate(),
			Edited: null
		});

		await row.save({ skipLoad: true });
		return {
			reply: (invocation === "add" || invocation === "create")
				? `Your alias "${name}" has been created successfully.`
				: `Your alias "${name}" has been replaced successfully.`
		};
	}
} satisfies AliasSubcommandDefinition;
