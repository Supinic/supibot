import { type AliasSubcommandDefinition } from "../index.js";
import { prefix } from "../../../utils/command-utils.js";
import { type AliasData, getAliasByNameAndUser, getGenericAliasRow } from "../alias-utils.js";

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

		const publishedAliasIds = await core.Query.getRecordset<AliasData["ID"][]>(rs => rs
			.select("ID")
			.from("data", "Custom_Command_Alias")
			.where("Channel IS NOT NULL")
			.where("Parent = %n", alias.ID)
			.flat("ID")
		);

		let publishString = "";
		if (publishedAliasIds.length !== 0) {
			await core.Query.getRecordDeleter(rd => rd
				.delete()
				.from("data", "Custom_Command_Alias")
				.where("ID IN %n+", publishedAliasIds)
				.where("Channel IS NOT NULL")
				.where("Parent = %n", alias.ID)
			);

			publishString = ` It was also published in ${publishedAliasIds.length} channels - these have also been removed.`;
		}

		const row = await getGenericAliasRow();
		await row.load(alias.ID);
		await row.delete();

		return {
			success: false,
			reply: `Your alias "${name}" has been successfully removed.${publishString}`
		};
	}
} satisfies AliasSubcommandDefinition;
