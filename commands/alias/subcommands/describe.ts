import { ALIAS_DESCRIPTION_LIMIT, getAliasByNameAndUser, getClassicAliasRow } from "../alias-utils.js";

import { type AliasSubcommandDefinition } from "../index.js";
import { prefix } from "../../../utils/command-utils.js";

export default {
	name: "describe",
	title: "Add description to your alias",
	aliases: [],
	default: false,
	description: [
		`<code>${prefix}alias describe (alias) (...description)</code>`,
		"Gives your command a description, which can then be checked by you or others.",
		`If you don't provide a description, or use the word "none" exactly, the description will be reset.`
	],
	execute: async function (context, subInvocation, ...args) {
		const [name, ...rest] = args;
		if (!name) {
			return {
				success: false,
				reply: `You didn't provide a name, or a command! Use: alias describe (name) (...description)"`
			};
		}

		const alias = await getAliasByNameAndUser(name, context.user.ID);
		if (!alias) {
			return {
				success: false,
				reply: `You don't have the "${name}" alias!`
			};
		}

		const description = rest.join(" ").trim();
		if (description.length > ALIAS_DESCRIPTION_LIMIT) {
			return {
				success: false,
				reply: `Your alias description is too long! Maximum of ${ALIAS_DESCRIPTION_LIMIT} is allowed.`
			};
		}

		const row = await getClassicAliasRow();
		await row.load(alias.ID);

		let verb;
		if (description.length === 0 || description === "none") {
			row.values.Description = null;
			verb = "reset";
		}
		else {
			row.values.Description = description;
			verb = "updated";
		}

		await row.save({ skipLoad: true });
		return {
			reply: `The description of your alias "${name}" has been ${verb} successfully.`
		};
	}
} satisfies AliasSubcommandDefinition;
