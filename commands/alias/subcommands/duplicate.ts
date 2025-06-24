import { SupiDate, SupiError } from "supi-core";
import { type AliasSubcommandDefinition } from "../index.js";
import { prefix } from "../../../utils/command-utils.js";
import {
	ALIAS_INVALID_NAME_RESPONSE,
	ALIAS_NAME_REGEX,
	getAliasByNameAndUser,
	getClassicAliasRow, isClassicAlias,
	isLinkedAlias
} from "../alias-utils.js";

export default {
	name: "duplicate",
	title: "Duplicate an alias",
	aliases: [],
	default: false,
	description: [
		`<code>${prefix}alias duplicate (old-name) (new-name)</code>`,
		"Creates a new alias (new-name) with the definition of an existing alias (old-name)."
	],
	execute: async function (context, subInvocation, ...args) {
		const [oldAliasName, newAliasName] = args;
		if (!oldAliasName || !newAliasName) {
			return {
				reply: `To duplicate an alias, you must provide both existing and new alias names!`
			};
		}
		else if (!ALIAS_NAME_REGEX.test(newAliasName)) {
			return {
				success: false,
				reply: `Your alias name is not valid! ${ALIAS_INVALID_NAME_RESPONSE}`
			};
		}

		const oldAlias = await getAliasByNameAndUser(oldAliasName, context.user.ID);
		if (!oldAlias) {
			return {
				success: false,
				reply: `You don't have the "${oldAliasName}" alias!`
			};
		}
		else if (isLinkedAlias(oldAlias)) {
			return {
				success: false,
				reply: `You cannot duplicate links to other aliases!`
			};
		}

		const newAlias = await getAliasByNameAndUser(newAliasName, context.user.ID);
		if (newAlias) {
			return {
				success: false,
				reply: `You already have the "${newAliasName}" alias!`
			};
		}

		if (!isClassicAlias(oldAlias)) {
			throw new SupiError({
			    message: "Assert error: Alias is not classic-type",
				args: { oldAlias }
			});
		}

		const row = await getClassicAliasRow();
		row.setValues({
			User_Alias: context.user.ID,
			Channel: null,
			Name: newAliasName,
			Command: oldAlias.Command,
			Invocation: oldAlias.Invocation,
			Arguments: oldAlias.Arguments,
			Description: null,
			Parent: oldAlias.ID,
			Created: new SupiDate(),
			Edited: null
		});

		await row.save();
		return {
			reply: `Successfully duplicated "${oldAliasName}" as "${newAliasName}"!`
		};
	}
} satisfies AliasSubcommandDefinition;
