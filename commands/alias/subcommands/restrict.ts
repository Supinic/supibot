import { getAliasByNameAndUser, getClassicAliasRow, isRestricted } from "../alias-utils.js";
import { type AliasSubcommandDefinition } from "../index.js";
import { prefix } from "../../../utils/command-utils.js";

export default {
	name: "restrict",
	title: "Restrict your alias from copying/linking",
	aliases: ["unrestrict"],
	default: false,
	description: [
		`<code>${prefix}alias restrict (name) (type)</code>`,
		`<code>${prefix}alias unrestrict (name) (type)</code>`,
		"Restricts, or unrestricts one of your aliases from being copied or linked by other people.",
		"You (as the creator of the alias) will still be able to copy and link it yourself, though.",
		`Use "copy" and "link" as the type name respectively to allow/disallow each operation.`
	],
	execute: async function (context, subInvocation, ...args) {
		const [name, restriction] = args;
		if (!name || !restriction || (restriction !== "link" && restriction !== "copy")) {
			return {
				success: false,
				reply: `You didn't provide a name or a correct restriction type! Use: "$alias ${subInvocation} (alias name) (copy/link)"`
			};
		}

		const alias = await getAliasByNameAndUser(name, context.user.ID);
		if (!alias) {
			return {
				success: false,
				reply: `You don't have the "${name}" alias!`
			};
		}

		const verb = (restriction === "link") ? "linked" : "copied";
		if (subInvocation === "restrict" && isRestricted(restriction, alias)) {
			return {
				success: false,
				reply: `Your alias ${name} is already restricted from being ${verb}!`
			};
		}
		else if (subInvocation === "unrestrict" && !isRestricted(restriction, alias)) {
			return {
				success: false,
				reply: `Your alias ${name} is already unrestricted from being ${verb}!`
			};
		}

		const row = await getClassicAliasRow();
		await row.load(alias.ID);
		row.values.Restrictions = (row.values.Restrictions) ? [...row.values.Restrictions] : [];

		if (subInvocation === "restrict") {
			row.values.Restrictions.push(restriction);
		}
		else if (subInvocation === "unrestrict") {
			const index = row.values.Restrictions.indexOf(restriction);
			row.values.Restrictions.splice(index, 1);

			if (row.values.Restrictions.length === 0) {
				row.values.Restrictions = null;
			}
		}

		await row.save({ skipLoad: true });
		return {
			reply: `Your alias ${name} has been successfully ${subInvocation}ed from being ${verb}!`
		};
	}
} satisfies AliasSubcommandDefinition;
