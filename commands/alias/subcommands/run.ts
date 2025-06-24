import { SupiError } from "supi-core";
import type { User } from "../../../classes/user.js";
import type { ContextAppendData } from "../../../classes/command.js";

import config from "../../../config.json" with { type: "json" };
import { type AliasSubcommandDefinition } from "../index.js";
import { prefix } from "../../../utils/command-utils.js";

import {
	ALIAS_NAME_REGEX,
	NESTED_ALIAS_LIMIT,
	type AliasData,
	getAliasByIdAsserted,
	parseAliasArguments,
	applyParameters,
	parseInvocationName,
	parseCommandName,
	isClassicAlias
} from "../alias-utils.js";

const bannedCommandCombinations = config.modules.commands.bannedCombinations;

export default {
	name: "run",
	title: "Run an alias",
	aliases: ["try"],
	default: true,
	description: [
		`<code>${prefix}$ (name)</code>`,
		`<code>${prefix}alias run (name)</code>`,
		"Runs your command alias.",

		"Examples:",
		`<code>${prefix}$<u>hello</u></code>`,
		`<code>${prefix}$ <u>hello</u></code>`,
		`<code>${prefix}alias run <u>hello</u></code>`,
		"",

		`<code>${prefix}alias try (user) (alias) (...arguments)</code>`,
		"Runs another user's alias, without needing to copy it from them first.",
		""
	],
	execute: async function (context, subInvocation, ...args) {
		let name: string;
		let user: User;

		if (subInvocation !== "try" && subInvocation !== "run") {
			throw new SupiError({
			    message: `Assert error: $alias run did not receive "run" or "try" as subInvocation`
			});
		}

		const runArgs = [...args];
		const [firstArg, secondArg] = runArgs;
		if (!firstArg) {
			return {
				success: false,
				reply: "No input provided!"
			};
		}

		if (subInvocation === "run") {
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
			if (alias && subInvocation === "try" && alias.User_Alias !== user.ID) {
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

		if (alias.Command === null && alias.Parent !== null) {
			const parentAlias = await getAliasByIdAsserted(alias.Parent);
			if (!parentAlias.User_Alias) {
				throw new SupiError({
				    message: "Assert error: Parent alias does not belong to a user",
					args: { parentAlias, alias }
				});
			}

			// When running a linked alias, make sure to actually use the link owner's data -
			// as if using $alias try (user) (linked alias)
			alias = parentAlias;
			subInvocation = "try";
			user = await sb.User.getAsserted(parentAlias.User_Alias);
		}
		else if (alias.Command === null && alias.Parent === null) {
			return {
				success: false,
				reply: `You tried to ${subInvocation} a linked alias, but the original has been deleted!`
			};
		}

		const aliasArguments = parseAliasArguments(alias);
		const { success, resultArguments, reply } = applyParameters(context, aliasArguments, runArgs.slice(1));
		if (!success) {
			return { success, reply };
		}

		if (!isClassicAlias(alias)) {
			throw new SupiError({
			    message: "Assert error: No classic alias obtained",
				args: { alias }
			});
		}

		let invocation = parseInvocationName(alias.Invocation);
		const commandData = parseCommandName(alias.Invocation);
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
		const aliasTry: ContextAppendData["aliasTry"] = {};
		if (subInvocation === "try") {
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
			hasExternalInput: Boolean(execution.hasExternalInput ?? commandData.Flags.includes("external-input")),
			isChannelAlias: Boolean(alias.Channel)
		};
	}
} satisfies AliasSubcommandDefinition;
