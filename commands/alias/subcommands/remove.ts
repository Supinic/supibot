import { type AliasSubcommandDefinition } from "../index.ts";
import { prefix } from "../../../utils/command-utils.ts";
import { type AliasData, cleanPublishedAliases, getAliasByNameAndUser, getGenericAliasRow } from "../alias-utils.ts";

export default {
	name: "remove",
	title: "Remove an alias",
	aliases: ["delete"],
	default: false,
	description: [
		`<code>${prefix}alias remove (name)</code>`,
		`<code>${prefix}alias delete (name)</code>`,
		"Removes your command alias with the given name.",
		"If some channels have published this alias, you will be notified about it after it's deleted."
	],
	execute: async function (context, subInvocation, ...args) {
		const [name] = args;
		if (!name) {
			return {
				success: false,
				reply: `No alias name provided!`
			};
		}

		const alias = await getAliasByNameAndUser(name, context.user.ID);
		if (!alias) {
			return {
				success: false,
				reply: `You don't have the "${name}" alias!`
			};
		}

		const { deletedIds } = await cleanPublishedAliases(alias.ID);
		const publishString = (deletedIds.length === 0)
			? ""
			: ` It was also published in ${deletedIds.length} channels - these have also been removed.`;

		const row = await getGenericAliasRow();
		await row.load(alias.ID);
		await row.delete();

		return {
			success: true,
			reply: `Your alias "${name}" has been successfully removed.${publishString}`
		};
	}
} satisfies AliasSubcommandDefinition;
