import { aliasBinding, prefix } from "../index.js";
import { ALIAS_NAME_REGEX, ALIAS_INVALID_NAME_RESPONSE, parseCommandName, type AliasData } from "../alias-utils.js";
import { SupiDate } from "supi-core";
import User from "../../../classes/user.js";

case "code":
case "check":
case "list":
case "show":
case "spy": {

}

export default aliasBinding({
	name: "add",
	title: "Item IDs",
	aliases: ["addedit", "create", "upsert"],
	default: false,
	description: [
		`<code>${prefix}alias add (name) (definition)</code>`,
		`<code>${prefix}alias create (name) (definition)</code>`,
		`Creates your command alias, e.g.:`,
		`<code>${prefix}alias add <u>hello</u> translate to:german Hello!</code>`
	],
	execute: async function (context, invocation, ...args) {
		const [firstName, secondName] = args;
		if (!firstName && !secondName) {
			const username = encodeURIComponent(context.user.Name);
			return {
				reply: `List of your aliases: https://supinic.com/bot/user/${username}/alias/list`
			};
		}

		let user: User;
		let aliasName: string;
		let prefix: string;
		if (firstName && !secondName) {
			const aliases = await core.Query.getRecordset<string[]>(rs => rs
				.select("Name")
				.from("data", "Custom_Command_Alias")
				.where("Channel IS NULL")
				.where("User_Alias = %n", context.user.ID)
				.flat("Name")
			);

			let targetAliases: string[] = [];
			const targetUser = await sb.User.get(firstName);
			if (targetUser) {
				targetAliases = await core.Query.getRecordset<string[]>(rs => rs
					.select("Name")
					.from("data", "Custom_Command_Alias")
					.where("Channel IS NULL")
					.where("User_Alias = %n", targetUser.ID)
					.flat("Name")
				);
			}

			// Not a username nor current user's alias name - error out
			if (targetAliases.length === 0 && !aliases.includes(firstName)) {
				return {
					success: false,
					reply: `Could not match your input to username or any of your aliases!`
				};
			}
			// Not a username, but current user has an alias with the provided name
			else if (targetAliases.length === 0 && aliases.includes(firstName)) {
				user = context.user;
				aliasName = firstName;
				prefix = "Your";
			}
			// Not current user's alias, but a username exists
			else if (targetUser && targetAliases.length > 0 && !aliases.includes(firstName)) { // Is a username
				const who = (targetUser === context.user) ? "your" : "their";
				const username = encodeURIComponent(targetUser.Name);
				return {
					reply: `List of ${who} aliases: https://supinic.com/bot/user/${username}/alias/list`
				};
			}
			// Both current user's alias, and a username exists - print out special case with both links
			else {
				const username = encodeURIComponent(context.user.Name);
				const escapedString = encodeURIComponent(firstName);
				return {
					reply: core.Utils.tag.trim `
						Special case!
						Your alias "${firstName}": https://supinic.com/bot/user/${username}/alias/detail/${escapedString}
						List of ${firstName}'s aliases: https://supinic.com/bot/user/${escapedString}/alias/list
					`
				};
			}
		}
		else {
			const userData = await sb.User.get(firstName);
			if (!userData) {
				return {
					success: false,
					reply: "Provided user does not exist!"
				};
			}

			user = userData;
			aliasName = secondName;
			prefix = (context.user === user) ? "Your" : "Their";
		}

		type PartialAliasData = Pick<AliasData, "Command" | "Invocation" | "Parent" | "Arguments">;
		let alias = await core.Query.getRecordset<PartialAliasData | undefined>(rs => rs
			.select("Command", "Invocation", "Arguments", "Parent")
			.from("data", "Custom_Command_Alias")
			.where("User_Alias = %n", user.ID)
			.where("Name COLLATE utf8mb4_bin = %s", aliasName)
			.limit(1)
			.single()
		);

		if (!alias) {
			const who = (context.user === user) ? "You" : "They";
			return {
				success: false,
				reply: `${who} don't have the "${aliasName}" alias!`
			};
		}

		let appendix = "";
		if (alias.Command === null && alias.Parent !== null) {
			// special case for linked aliases
			alias = await core.Query.getRecordset(rs => rs
				.select("User_Alias", "Name", "Command", "Invocation", "Arguments", "Parent")
				.from("data", "Custom_Command_Alias")
				.where("ID = %n", alias.Parent)
				.limit(1)
				.single()
			);

			const originalUser = await sb.User.get(alias.User_Alias);
			appendix = `This alias is a link to "${alias.Name}" made by ${originalUser.Name}.`;
		}
		else if (alias.Command === null && alias.Parent === null) {
			return {
				reply: `${prefix} alias is a link to a different alias, but the original has been deleted.`
			};
		}

		let message;
		const aliasArgs = (alias.Arguments) ? JSON.parse(alias.Arguments) : [];
		if (invocation === "code") {
			message = `${alias.Invocation} ${aliasArgs.join(" ")}`;
		}
		else {
			message = `${appendix} ${prefix} alias "${aliasName}" has this definition: ${alias.Invocation} ${aliasArgs.join(" ")}`;
		}

		const limit = context.channel?.Message_Limit ?? context.platform.Message_Limit;
		const cooldown = (context.append.pipe) ? null : this.Cooldown;

		if (!context.append.pipe && message.length >= limit) {
			const escapedAliasName = encodeURIComponent(aliasName);
			const escapedUsername = encodeURIComponent(user.Name);
			const prefixMessage = (invocation !== "code")
				? `${prefix} alias "${aliasName}" details: `
				: "";

			return {
				cooldown,
				reply: `${prefixMessage}https://supinic.com/bot/user/${escapedUsername}/alias/detail/${escapedAliasName}`
			};
		}
		else {
			return {
				cooldown,
				reply: message
			};
		}
});
