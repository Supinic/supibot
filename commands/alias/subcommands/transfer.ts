import { type AliasSubcommandDefinition, prefix } from "../index.js";
import { AliasData, getGenericAliasRow } from "../alias-utils.js";

export default {
	name: "transfer",
	title: "Move aliases to a new username",
	aliases: [],
	default: false,
	description: [
		`<code>${prefix}alias transfer (previous username)</code>`,
		"If you renamed on Twitch, this command will transfer all aliases (including links) from your previous username to the current one.",
		"Only works on Twitch at the moment, by checking that it is the same account for your and the old username.",
		"You must also not have any conflicting aliases - you will get warned first.",
	],
	execute: async function (context, subInvocation, ...args) {
		if (!context.user.Twitch_ID) {
			return {
				success: false,
				reply: `Transferring aliases currently only works for Twitch users!`
			};
		}

		const [oldUsername] = args;
		if (!oldUsername) {
			return {
				success: false,
				reply: "You must provide your previous username!"
			};
		}

		const oldUserData = await sb.User.get(oldUsername);
		if (!oldUserData || !oldUserData.Twitch_ID) {
			return {
				success: false,
				reply: `I have not seen that user on Twitch before!`
			};
		}
		else if (context.user.Twitch_ID !== oldUserData.Twitch_ID) {
			return {
				success: false,
				reply: `Your Twitch ID is not the same as that user's!`
			};
		}

		const conflictingAliases = await core.Query.getRecordset<string[]>(rs => rs
			.select("Custom_Command_Alias.Name")
			.from("data", "Custom_Command_Alias")
			.join({
				toTable: "Custom_Command_Alias",
				alias: "Shared",
				on: `Shared.Name = Custom_Command_Alias.Name AND Shared.User_Alias = ${oldUserData.ID}`
			})
			.where("Custom_Command_Alias.User_Alias = %n", context.user.ID)
			.groupBy("Custom_Command_Alias.Name")
			.flat("Name")
		);

		if (conflictingAliases.length !== 0) {
			return {
				success: false,
				reply: core.Utils.tag.trim `
					You have ${conflictingAliases.length} aliases that your previous username also has!
					Rename or delete them first, then run this command again.
					List: ${conflictingAliases.join(", ")}
				`
			};
		}

		const aliasIDs = await core.Query.getRecordset<AliasData["ID"][]>(rs => rs
			.select("ID")
			.from("data", "Custom_Command_Alias")
			.where("User_Alias = %n", oldUserData.ID)
			.flat("ID")
		);

		for (const aliasID of aliasIDs) {
			const row = await getGenericAliasRow();
			await row.load(aliasID);

			row.values.User_Alias = context.user.ID;
			await row.save({ skipLoad: true });
		}

		return {
			reply: `Successfully transferred ${aliasIDs.length} aliases from the username "${oldUserData.Name}" to "${context.user.Name}".`
		};
	}
} satisfies AliasSubcommandDefinition;
