import { type AliasSubcommandDefinition } from "../index.js";
import { prefix } from "../../../utils/command-utils.js";
import { getAliasByNameAndUser } from "../alias-utils.js";

export default {
	name: "inspect",
	title: "Check description",
	aliases: [],
	default: false,
	description: [
		`<code>${prefix}alias inspect (alias)</code>`,
		`<code>${prefix}alias inspect (username) (alias)</code>`,
		"If your or someone else's alias has a description, this command will print it to chat."
	],
	execute: async function (context, subInvocation, ...args) {
		let user;
		let aliasName;
		let prefix;

		const [firstName, secondName] = args;
		if (!firstName && !secondName) {
			return {
				success: false,
				reply: `You didn't provide an alias or user name! Use: "$alias inspect (your alias)" or "$alias inspect (username) (alias)"`
			};
		}
		else if (firstName && !secondName) {
			user = context.user;
			aliasName = firstName;
			prefix = "You";
		}
		else {
			user = await sb.User.get(firstName);
			if (!user) {
				return {
					success: false,
					reply: "Provided user does not exist!"
				};
			}

			aliasName = secondName;
			prefix = (context.user === user) ? "You" : "They";
		}

		const alias = await getAliasByNameAndUser(aliasName, user.ID);
		if (!alias) {
			return {
				success: false,
				reply: `${prefix} don't have the "${aliasName}" alias!`
			};
		}

		return {
			cooldown: (context.append.pipe) ? null : this.Cooldown,
			reply: (alias.Description)
				? `${aliasName}: ${alias.Description}`
				: `Alias "${aliasName}" has no description.`
		};
	}
} satisfies AliasSubcommandDefinition;
