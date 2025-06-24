import { type AliasSubcommandDefinition } from "../index.js";
import { prefix } from "../../../utils/command-utils.js";

import { getLinkedAlias, isLinkedAlias, getAliasByNameAndUser, parseAliasArguments } from "../alias-utils.js";
import { type User } from "../../../classes/user.js";

export default {
	name: "check",
	title: "Check/list alias definition",
	aliases: ["code", "list", "show", "spy"],
	default: false,
	description: [
		`<code>${prefix}alias check</code>`,
		`<code>${prefix}alias spy</code>`,
		`<code>${prefix}alias show</code>`,
		"Checks your or someone else's alias definition.",
		"",

		`<code>${prefix}alias code</code>`,
		"Posts the definition directly, without any surroudning text",
		"",

		`<code>${prefix}alias check</code>`,
		`<code>${prefix}alias list</code>`,
		"No parameters or using <code>list</code> - gives you a link to the list of all of your aliases.",
		`You can also check them in <a href="/user/alias/list">this list</a> - after you log in.`,
		"",

		`<code>${prefix}alias check (user)</code>`,
		"One parameter - user name: gives you a link to the list of that user's aliases.",
		"",

		`<code>${prefix}alias check (alias name)</code>`,
		"One parameter - alias name: gives the definition of your alias with that name.",
		"",

		`<code>${prefix}alias check (alias name)</code>`,
		"One parameter - alias name: gives the definition of your alias with that name.",
		"",

		`<code>${prefix}alias check (user) (alias name)</code>`,
		"Two parameters - user name + alias name - gives you the definition of that user's alias."
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

		const alias = await getAliasByNameAndUser(aliasName, user.ID);
		if (!alias) {
			const who = (context.user === user) ? "You" : "They";
			return {
				success: false,
				reply: `${who} don't have the "${aliasName}" alias!`
			};
		}

		let appendix = "";
		let targetAlias = alias;
		if (isLinkedAlias(alias)) {
			// special case for linked aliases
			const linkedAlias = await getLinkedAlias(alias.Parent);
			const originalUser = await sb.User.getAsserted(linkedAlias.User_Alias);

			appendix = `This alias is a link to "${alias.Name}" made by ${originalUser.Name}.`;
			targetAlias = linkedAlias;
		}
		else if (alias.Command === null && alias.Parent === null) {
			return {
				reply: `${prefix} alias is a link to a different alias, but the original has been deleted.`
			};
		}

		let message;
		const aliasArgs = parseAliasArguments(targetAlias);
		if (invocation === "code") {
			message = `${targetAlias.Invocation} ${aliasArgs.join(" ")}`;
		}
		else {
			message = `${appendix} ${prefix} alias "${aliasName}" has this definition: ${targetAlias.Invocation} ${aliasArgs.join(" ")}`;
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
	}
} satisfies AliasSubcommandDefinition;
