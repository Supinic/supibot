import { getAliasByNameAndUser, getClassicAliasRow, isLinkedAlias, parseCommandName } from "../alias-utils.js";
import { type AliasSubcommandDefinition, prefix } from "../index.js";

export default {
	name: "edit",
	title: "Edit alias",
	aliases: [],
	default: false,
	description: [
		`<code>${prefix}alias edit (name)</code>`,
		`<code>${prefix}alias edit <u>hello</u> translate to:italian Hello!</code>`,
		"Edits an existing alias, without the need of removing and re-adding it."
	],
	execute: async function (context, subInvocation, ...args) {
		const [name, command, ...rest] = args;
		if (!name || !command) {
			return {
				success: false,
				reply: `No alias or command name provided!"`
			};
		}

		const commandCheck = parseCommandName(command);
		if (!commandCheck) {
			return {
				success: false,
				reply: `Cannot edit alias! The command "${command}" does not exist.`
			};
		}

		const alias = await getAliasByNameAndUser(name, context.user.ID);
		if (!alias) {
			return {
				success: false,
				reply: `You don't have the "${name}" alias!`
			};
		}
		else if (isLinkedAlias(alias)) {
			return {
				success: false,
				reply: `You cannot edit links to other aliases!`
			};
		}

		const row = await getClassicAliasRow();
		await row.load(alias.ID);

		row.setValues({
			Command: commandCheck.Name,
			Invocation: command,
			Arguments: (rest.length > 0) ? JSON.stringify(rest) : null
		});

		await row.save({ skipLoad: true });
		return {
			reply: `Your alias "${name}" has been successfully edited.`
		};
	}
} satisfies AliasSubcommandDefinition;
