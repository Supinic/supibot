import { type AliasSubcommandDefinition, prefix } from "../index.js";
import {
	ALIAS_NAME_REGEX,
	ALIAS_INVALID_NAME_RESPONSE,
	getAliasByNameAndUser,
	getGenericAliasRow,
    AliasData
} from "../alias-utils.js";
import type { User } from "../../../classes/user.js";

export default {
	name: "run",
	title: "Run an alias",
	aliases: ["try"],
	default: false,
	description: [

	],
	execute: async function (context, aliasInvocation: "run" | "try", ...args) {
		let name: string;
		let user: User;

		const runArgs = [...args];
		const [firstArg, secondArg] = runArgs;
		if (!firstArg) {
			return {
				success: false,
				reply: "No input provided!"
			};
		}

		if (aliasInvocation === "run") {
			name = firstArg;
			user = context.user;
		}
		else {
			if (!secondArg) {
				return {
					success: false,
					reply: `You didn't provide an alias to try!`
				};
			}

			runArgs.splice(0, 1);
			name = secondArg;

			const userData = await sb.User.get(firstArg);
			if (!userData) {
				return {
					success: false,
					reply: `Provided user does not exist!`
				};
			}

			user = userData;
		}

		const eligibleAliases = await core.Query.getRecordset<AliasData[]>(rs => {
			rs.select("*");
			rs.from("data", "Custom_Command_Alias");
			rs.where("Name COLLATE utf8mb4_bin = %s", name);
			if (context.channel) {
				rs.where("User_Alias = %n OR Channel = %n", user.ID, context.channel.ID);
			}
			else {
				rs.where("User_Alias = %n", user.ID);
			}

			return rs;
		});

		let alias: AliasData | undefined;
		const who = (user === context.user) ? "You" : "They";

		if (eligibleAliases.length <= 1) {
			alias = eligibleAliases.at(0);
			if (alias && aliasInvocation === "try" && alias.User_Alias !== user.ID) {
				return {
					success: false,
					reply: `${who} don't have the "${name}" alias!`
				};
			}
		}
		else {
			alias = eligibleAliases.find(i => i.User_Alias === user.ID) ?? eligibleAliases.find(i => i.Channel === context.channel?.ID);
		}

		if (!alias) {
			if (!ALIAS_NAME_REGEX.test(name)) {
				return {
					success: false,
					reply: null
				};
			}

			return {
				success: false,
				reply: `${who} don't have the "${name}" alias!`
			};
		}
		else if (alias.Command === null && alias.Parent !== null) {
			alias = await core.Query.getRecordset(rs => rs
				.select("User_Alias", "Command", "Invocation", "Arguments", "Parent")
				.from("data", "Custom_Command_Alias")
				.where("ID = %n", alias.Parent)
				.limit(1)
				.single()
			);

			// When running a linked alias, make sure to actually use the link owner's data -
			// as if using $alias try (user) (linked alias)
			aliasInvocation = "try";
			user = await sb.User.get(alias.User_Alias);
		}
		else if (alias.Command === null && alias.Parent === null) {
			return {
				success: false,
				reply: `You tried to ${aliasInvocation} a linked alias, but the original has been deleted!`
			};
		}

		const aliasArguments = (alias.Arguments) ? JSON.parse(alias.Arguments) : [];

		const { success, reply, resultArguments } = AliasUtils.applyParameters(context, aliasArguments, runArgs.slice(1));
		if (!success) {
			return { success, reply };
		}

		let invocation = AliasUtils.parseInvocationName(alias.Invocation);
		const commandData = AliasUtils.parseCommandName(alias.Invocation);
		if (!commandData) {
			return {
				success: false,
				reply: `Your alias contains the command ${invocation} which has been archived, retired, or removed!`
			};
		}
		else if (context.append.pipe && !commandData.Flags.includes("pipe")) {
			return {
				success: false,
				reply: `Cannot use the ${invocation} command inside of a pipe, despite being wrapped in an alias!`
			};
		}

		// If the invocation is `$alias try (user) (alias)`, and the invoked alias contains another alias
		// execution, replace the sub-alias from `$alias run` (or `$$`) to `$alias try`, so that the user
		// who is trying the alias does not need to care about dependencies.
		const aliasTry = {};
		if (aliasInvocation === "try") {
			aliasTry.userName = user.Name;

			if (invocation === "$" && commandData === this) {
				invocation = "alias";
				resultArguments.unshift("try", user.Name);
			}
			else if (resultArguments[0] === "run" && commandData === this) {
				resultArguments[0] = "try";
				resultArguments.splice(1, 0, user.Name);
			}
		}

		const aliasCount = (context.append.aliasCount ?? 0) + 1;
		if (aliasCount > NESTED_ALIAS_LIMIT) {
			return {
				success: false,
				reply: core.Utils.tag.trim `
						Your alias cannot continue!
						It causes more than ${NESTED_ALIAS_LIMIT} alias calls.
						Please reduce the complexity first.
					`
			};
		}

		let totalUsedCommandNames;
		if (context.append.commandList) {
			totalUsedCommandNames = context.append.commandList;

			const aliasIndex = totalUsedCommandNames.indexOf("alias");
			if (aliasIndex !== -1) {
				totalUsedCommandNames.splice(aliasIndex, 1, commandData.Name);
			}
			else {
				totalUsedCommandNames.push(commandData.Name);
			}

			for (const combination of bannedCommandCombinations) {
				let index = 0;
				for (const commandName of totalUsedCommandNames) {
					if (commandName === combination[index]) {
						index++;
					}

					if (!combination[index]) {
						return {
							success: false,
							reply: `Your alias contains a combination of commands that is not allowed! Commands: ${combination.join(" → ")}`
						};
					}
				}
			}
		}
		else {
			totalUsedCommandNames = [commandData.Name];
		}

		const execution = await sb.Command.checkAndExecute({
			command: invocation,
			args: resultArguments,
			user: context.user,
			channel: context.channel,
			platform: context.platform,
			platformSpecificData: context.platformSpecificData,
			options: {
				...context.append,
				alias: true,
				aliasArgs: Object.freeze(runArgs.slice(1)),
				aliasCount,
				aliasStack: [
					...(context.append.aliasStack ?? []),
					name
				],
				aliasTry,
				commandList: totalUsedCommandNames,
				skipBanphrases: true,
				skipMention: true,
				skipPending: true,
				partialExecute: true,
				tee: context.tee
			}
		});

		return {
			...execution,
			cooldown: (context.append.pipe) ? null : this.Cooldown,
			hasExternalInput: Boolean(execution?.hasExternalInput ?? commandData.Flags.includes("externalInput")),
			isChannelAlias: Boolean(alias.Channel)
		};
}
} satisfies AliasSubcommandDefinition;
