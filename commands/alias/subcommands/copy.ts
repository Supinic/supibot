import { SupiDate, SupiError } from "supi-core";
import { type AliasSubcommandDefinition } from "../index.js";
import { prefix } from "../../../utils/command-utils.js";
import {
	ALIAS_NAME_REGEX,
	getAliasById,
	getAliasByNameAndUser,
	getClassicAliasRow,
	isClassicAlias,
	isLinkedAlias,
	isRestricted
} from "../alias-utils.js";

export default {
	name: "copy",
	title: "Copy",
	aliases: ["copyplace"],
	default: false,
	description: [
		`<code>${prefix}alias copy (username) (alias)</code>`,
		`<code>${prefix}alias copyplace (username) (alias)</code>`,
		"Takes someone else's alias, and attempts to copy it with the same name for you.",
		"If you use <code>copy</code>, it will only create an alias if you don't already have one with that name.",
		"If you use <code>copyplace</code>, it will replace whatever alias you have with that name without asking."
	],
	execute: async function (context, type, ...args) {
		const [targetUserName, targetAliasName] = args;
		if (!targetUserName) {
			return {
				success: false,
				reply: "No target username provided!"
			};
		}
		else if (!targetAliasName) {
			return {
				success: false,
				reply: "No target alias provided!"
			};
		}
		else if (!ALIAS_NAME_REGEX.test(targetAliasName)) {
			return {
				success: false,
				reply: "The copied alias's name is not valid and therefore can't be copied!"
			};
		}

		const targetUser = await sb.User.get(targetUserName);
		if (!targetUser) {
			return {
				success: false,
				reply: "Invalid user provided!"
			};
		}

		let targetAlias = await getAliasByNameAndUser(targetAliasName, targetUser.ID);
		if (!targetAlias) {
			return {
				success: false,
				reply: `User "${targetUserName}" doesn't have the "${targetAliasName}" alias!`
			};
		}
		else if (isLinkedAlias(targetAlias)) {
			const parentAlias = await getAliasById(targetAlias.Parent);
			if (!parentAlias) {
				return {
					success: false,
					reply: "You cannot copy this alias because the original it links to has been deleted!"
				};
			}

			targetAlias = parentAlias;
		}

		if (!isClassicAlias(targetAlias)) {
			throw new SupiError({
			    message: "Assert error: Alias is not classic-type",
				args: { targetAlias }
			});
		}

		if (context.user !== targetUser && isRestricted("copy", targetAlias)) {
			return {
				success: false,
				reply: `You cannot copy this alias! Its creator has prevented new copies from being created.`
			};
		}

		const currentAlias = await getAliasByNameAndUser(targetAliasName, context.user.ID);
		if (currentAlias && type !== "copyplace") {
			return {
				success: false,
				reply: `Cannot copy alias "${targetAliasName} - you already have it! If you want to copy + replace, use "alias copyplace".`
			};
		}

		const row = await getClassicAliasRow();
		if (currentAlias) {
			await row.load(currentAlias.ID);
		}

		row.setValues({
			User_Alias: context.user.ID,
			Channel: null,
			Name: targetAliasName,
			Command: targetAlias.Command,
			Invocation: targetAlias.Invocation,
			Arguments: targetAlias.Arguments,
			Description: null,
			Parent: targetAlias.ID,
			Created: new SupiDate(),
			Edited: null
		});

		await row.save({ skipLoad: true });

		const verb = (type === "copyplace") ? "copied and replaced" : "copied";
		return {
			reply: `Alias "${targetAliasName}" ${verb} successfully.`
		};
	}
} satisfies AliasSubcommandDefinition;
