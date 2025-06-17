import type { User } from "../../classes/user.js";
import type { Channel } from "../../classes/channel.js";
import type { Command, Context } from "../../classes/command.js";
import { SupiDate, SupiError } from "supi-core";

export const NESTED_ALIAS_LIMIT = 10;
export const ALIAS_DESCRIPTION_LIMIT = 250;

export const ALIAS_NAME_REGEX = /^[-\w\u00A9\u00AE\u2000-\u3300\uD83C\uD000-\uDFFF\uD83D\uD000-\uDFFF\uD83E\uD000-\uDFFF]{2,30}$/;
export const ALIAS_INVALID_NAME_RESPONSE = "Your alias should only contain letters, numbers and be 2-30 characters long.";

export const parseCommandName = (string: string) => {
	const { prefix } = sb.Command;
	return (string.startsWith(prefix) && string.length > prefix.length)
		? sb.Command.get(string.slice(prefix.length))
		: sb.Command.get(string);
};

export const parseInvocationName = (string: string) => {
	const { prefix } = sb.Command;
	return (string.startsWith(prefix) && string.length > prefix.length)
		? string.slice(prefix.length)
		: string;
};

export type AliasData = {
	ID: number;
	User_Alias: User["ID"] | null;
	Channel: Channel["ID"] | null;
	Name: string;
	Command: Command["Name"];
	Invocation: Command["Name"];
	Arguments: string | null;
	Description: string | null;
	Parent: AliasData["ID"];
	Restrictions: ("copy" | "link")[] | null;
	Created: SupiDate;
	Edited: SupiDate | null;
};

/**
 * Determines whether an alias is restricted from being copied or linked.
 */
export const isRestricted = (type: "copy" | "link", aliasData: AliasData) => (aliasData.Restrictions ?? []).includes(type);

export const applyParameters = (context: Context, aliasArguments: string[], commandArguments: string[]) => {
	let errorReason: string | undefined;
	const resultArguments: string[] = [];
	const numberRegex = /(?<order>-?\d+)(\.\.(?<range>-?\d+))?(?<rest>\+?)/;
	const strictNumberRegex = /^[\d-.+]+$/;

	for (let i = 0; i < aliasArguments.length; i++) {
		const parsed = aliasArguments[i].replaceAll(/\${(.+?)}/g, (total: string, match: string): string => {
			const numberMatch = match.match(numberRegex);
			if (numberMatch && strictNumberRegex.test(match)) {
				const { groups } = numberMatch;
				if (!groups) {
					throw new SupiError({
					    message: "Assert error: No alias argument regex groups exist",
						args: { groups, aliasArguments, commandArguments }
					});
				}

				let order = Number(groups.order);
				if (order < 0) {
					order = commandArguments.length + order;
				}

				let range = (groups.range) ? Number(groups.range) : null;
				if (typeof range === "number") {
					if (range < 0) {
						range = commandArguments.length + range + 1;
					}

					if (range < order) {
						const temp = range;
						range = order;
						order = temp;
					}
				}

				const useRest = (groups.rest === "+");
				if (useRest && range) {
					errorReason = `Cannot combine both the "range" (..) and "rest" (+) argument symbols!`;
					return "";
				}
				else if (useRest) {
					return commandArguments.slice(order).join(" ");
				}
				else if (range) {
					return commandArguments.slice(order, range).join(" ");
				}
				else {
					return commandArguments[order] ?? "";
				}
			}
			else if (match === "executor") {
				return context.user.Name;
			}
			else if (match === "channel") {
				return context.channel?.Description ?? context.channel?.Name ?? "[private messages]";
			}
			else {
				return total;
			}
		});

		if (errorReason) {
			return {
				success: false,
				reply: errorReason
			};
		}

		resultArguments.push(...parsed.split(" "));
	}

	return {
		success: true,
		resultArguments
	};
};
