import { type AliasSubcommandDefinition, prefix } from "../index.js";
import {
	ALIAS_NAME_REGEX,
	ALIAS_INVALID_NAME_RESPONSE,
	getChannelAlias,
	getAliasByNameAndUser,
	getClassicAliasRow
} from "../alias-utils.js";

export default {
	name: "publish",
	title: "Publish alias in a channel",
	aliases: ["unpublish"],
	default: false,
	description: [
		`<code>${prefix}alias publish (alias) (username)</code>`,
		`<code>${prefix}alias unpublish (alias)</code>`,
		"Channel owners and ambassadors are able to \"publish\" an existing alias in the channel they're authorized in.",
		"An alias being published means that anyone in that channel will be able to use it as if they had made it.",
		"Naturally, if a user has their own alias with the same name, that one will be used first."
	],
	execute: async function (context, invocation, ...args) {
		const channel = context.channel;
		if (!channel) {
			return {
				success: false,
				reply: `This subcommand can only be used in the channel you want the alias to be global in!`
			};
		}

		const permissions = await context.getUserPermissions();
		if (permissions.flag === sb.User.permissions.regular) {
			return {
				success: false,
				reply: `Only the owner and ambassadors of this channel can use this subcommand!`
			};
		}

		const [aliasName, userName] = args;
		if (!aliasName) {
			return {
				success: false,
				reply: `No alias name provided!`
			};
		}

		const existing = await getChannelAlias(aliasName, channel.ID);
		if (invocation === "publish") {
			const userData = (userName)
				? await sb.User.get(userName)
				: context.user;

			if (!userData) {
				return {
					success: false,
					reply: `Provided user does not exist!`
				};
			}

			if (!ALIAS_NAME_REGEX.test(aliasName)) {
				return {
					success: false,
					reply: `Published alias name is not valid! ${ALIAS_INVALID_NAME_RESPONSE}`
				};
			}

			const alias = await getAliasByNameAndUser(aliasName, userData.ID);
			if (!alias) {
				return {
					success: false,
					reply: `That user does not have an alias with that name!`
				};
			}
			else if (existing) {
				const sourceAlias = await getClassicAliasRow();
				await sourceAlias.load(existing.Parent);

				const sourceAuthorData = await sb.User.getAsserted(sourceAlias.values.User_Alias);
				return {
					success: false,
					reply: core.Utils.tag.trim `
						The alias name "${aliasName}" (by ${sourceAuthorData.Name}) is already published in this channel!
						If you want to publish the version made by ${userData.Name}, you must unpublish the other one first.
					`
				};
			}

			const row = await core.Query.getRow("data", "Custom_Command_Alias");
			row.setValues({
				Name: aliasName,
				Channel: context.channel.ID,
				Parent: alias.Parent ?? alias.ID
			});

			await row.save({ skipLoad: true });
			return {
				reply: `Successfully published alias ${aliasName} in this channel. Users in this channel can now use it directly.`
			};
		}
		else {
			if (!existing) {
				return {
					success: false,
					reply: `That alias has not been published in this channel!`
				};
			}

			const row = await core.Query.getRow("data", "Custom_Command_Alias");
			await row.load(existing.ID);
			await row.delete();

			return {
				reply: `Successfully unpublished alias ${aliasName} in this channel. Users in this channel won't be able to use it directly.`
			};
		}
	}
} satisfies AliasSubcommandDefinition;
