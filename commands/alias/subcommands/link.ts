import { SupiDate, SupiError } from "supi-core";
import { type AliasSubcommandDefinition } from "../index.js";
import { prefix } from "../../../utils/command-utils.js";
import {
	ALIAS_NAME_REGEX,
	ALIAS_INVALID_NAME_RESPONSE,
	getAliasByNameAndUser,
	getLinkedAliasRow,
	getParentAlias,
	isLinkedAlias,
	isRestricted
} from "../alias-utils.js";

export default {
	name: "link",
	title: "Link",
	aliases: ["linkplace"],
	default: false,
	description: [
		`<code>${prefix}alias link (username) (alias)</code>`,
		`<code>${prefix}alias link (username) (alias) (custom name)</code>`,
		`<code>${prefix}alias linkplace (username) (alias)</code>`,
		`<code>${prefix}alias linkplace (username) (alias) (custom name)</code>`,
		"Takes someone else's alias, and creates a link of it for you, with the same name.",
		"A link simply executes the user's alias, without you needing to specify it.",
		"If the original link changes, then so will the execution of your link - as it is the same alias, really.",
		"If the original is deleted, then your link will become invalid.",
		"",

		"This is recommended to use with reputable alias creators, or if you actually trust someone with their alias and the changes.",
		"You can also rename the link immediately by providing your own custom alias name at the end of the command.",
		"If you use <code>linkplace</code>, the command will replace any alias with the same name that you might already have.",
		"",

		`<code>${prefix}alias link (username) (alias) (custom name)</code>`,
		"Takes someone else's alias, and creates a link of it for you, with your own custom name for it.",
		"This can also be used to create links to your own aliases - essentially creating aliases of your own aliases 😅"
	],
	execute: async function (context, subInvocation, ...args) {
		const [userName, aliasName] = args;
		if (!userName || !aliasName) {
			return {
				success: false,
				reply: `You didn't provide a user, or the alias name! Use: alias link (user) (alias name)`
			};
		}

		const customLinkName = args.at(2);
		const name = customLinkName ?? aliasName;
		const existingAlias = await getAliasByNameAndUser(name, context.user.ID);
		if (existingAlias && subInvocation !== "linkplace") {
			return {
				success: false,
				reply: `Cannot link a new alias - you already have an alias with this name!`
			};
		}

		const targetUserData = await sb.User.get(userName);
		if (!targetUserData) {
			return {
				success: false,
				reply: `Provided user does not exist!`
			};
		}

		let targetAlias = await getAliasByNameAndUser(aliasName, targetUserData.ID);
		if (!targetAlias) {
			return {
				success: false,
				reply: `Provided user does not have the "${aliasName}" alias!`
			};
		}
		else if (context.user !== targetUserData && isRestricted("link", targetAlias)) {
			return {
				success: false,
				reply: `You cannot link this alias! Its creator has prevented new links from being created.`
			};
		}

		let appendix = "";
		if (isLinkedAlias(targetAlias)) {
			// If attempting to link an already linked alias, change the pointer to the original alias
			const linkedAlias = await getParentAlias(targetAlias);
			if (!linkedAlias) {
				return {
				    success: false,
					reply: "You cannot link to this alias because the original it links to has been deleted!"
				};
			}

			const originalUser = await sb.User.getAsserted(linkedAlias.User_Alias);
			appendix = `You tried to create a link out of an already linked alias (alias ${targetAlias.Name} by ${originalUser.Name}), so I used the original as your template.`;
			targetAlias = linkedAlias;
			targetAlias.Name = aliasName;
		}
		else if (targetAlias.Command === null && targetAlias.Parent === null) {
			return {
				success: false,
				reply: `Unfortunately, it looks like the original alias has been removed!`
			};
		}
		else if (!ALIAS_NAME_REGEX.test(targetAlias.Name)) {
			return {
				success: false,
				reply: `Linked alias name is not valid! ${ALIAS_INVALID_NAME_RESPONSE}`
			};
		}

		const row = await getLinkedAliasRow();
		if (existingAlias) {
			if (subInvocation !== "linkplace") {
				throw new SupiError({
					message: "Assert error: sanity check - reached linkplace without $alias linkplace"
				});
			}

			await row.load(existingAlias.ID);
		}

		row.setValues({
			User_Alias: context.user.ID,
			Channel: null,
			Name: name,
			Command: null,
			Invocation: null,
			Arguments: null,
			Created: new SupiDate(),
			Edited: null,
			Description: targetAlias.Description,
			Parent: targetAlias.ID
		});

		await row.save({ skipLoad: true });

		const verb = (subInvocation === "linkplace") ? "linked and replaced" : "linked";
		const nameString = (customLinkName && customLinkName !== targetAlias.Name)
			? `, with a custom name "${customLinkName}"`
			: "";

		return {
			reply: `Successfully ${verb} alias${nameString}. When the original changes, so will yours. ${appendix}`
		};
	}
} satisfies AliasSubcommandDefinition;
