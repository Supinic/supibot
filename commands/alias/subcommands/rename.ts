import { aliasBinding, prefix } from "../index.js";
import {
	ALIAS_NAME_REGEX,
	ALIAS_INVALID_NAME_RESPONSE,
	getAliasByNameAndUser,
	getGenericAliasRow
} from "../alias-utils.js";

export default aliasBinding({
	name: "rename",
	title: "Rename an alias",
	aliases: [],
	default: false,
	description: [
		`<code>${prefix}alias rename (old-name) (new-name)</code>`,
		"Renames your command alias from old-name to new-name."
	],
	execute: async function (context, invocation, ...args) {
		const [oldAliasName, newAliasName] = args;
		if (!oldAliasName || !newAliasName) {
			return {
				success: false,
				reply: "You must provide both the current alias name and the new one!"
			};
		}
		else if (!ALIAS_NAME_REGEX.test(newAliasName)) {
			return {
				success: false,
				reply: `Your new alias name is not valid! ${ALIAS_INVALID_NAME_RESPONSE}`
			};
		}

		const oldAlias = await getAliasByNameAndUser(oldAliasName, context.user.ID);
		if (!oldAlias) {
			return {
				success: false,
				reply: `You don't have the "${oldAliasName}" alias!`
			};
		}

		const newAlias = await getAliasByNameAndUser(newAliasName, context.user.ID);
		if (newAlias) {
			return {
				success: false,
				reply: `You already have the "${newAliasName}" alias!`
			};
		}

		const row = await getGenericAliasRow();
		await row.load(oldAlias.ID);
		row.values.Name = newAliasName;

		await row.save({ skipLoad: true });

		return {
			success: true,
			reply: `Your alias "${oldAliasName}" has been successfully renamed to "${newAliasName}".`
		};
	}
});
