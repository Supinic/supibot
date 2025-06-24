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
	Command: Command["Name"] | null;
	Invocation: Command["Name"] | null;
	Arguments: string | null;
	Description: string | null;
	Parent: AliasData["ID"] | null;
	Restrictions: ("copy" | "link")[] | null;
	Created: SupiDate;
	Edited: SupiDate | null;
};
type ClassicAliasData = AliasData & {
	User_Alias: User["ID"];
	Channel: null;
	Command: Command["Name"];
	Invocation: Command["Name"];
	Arguments: string | null;
}
type LinkedAliasData = AliasData & {
	User_Alias: User["ID"];
	Channel: null;
	Command: null;
	Invocation: null;
	Arguments: null;
	Parent: AliasData["ID"];
};
type ChannelAliasData = AliasData & {
	User_Alias: null;
	Channel: Channel["ID"];
	Command: null;
	Invocation: null;
	Arguments: null;
	Parent: AliasData["ID"];
};

export const parseAliasArguments = (aliasData: AliasData): string[] => {
	if (!aliasData.Arguments) {
		return [];
	}

	return JSON.parse(aliasData.Arguments) as string[];
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
				reply: errorReason,
				resultArguments: [] as string[]
			};
		}

		resultArguments.push(...parsed.split(" "));
	}

	return {
		success: true,
		resultArguments
	};
};

export const getAliasByNameAndUser = async (name: string, userId: User["ID"]) => (
	await core.Query.getRecordset<AliasData | undefined>(rs => rs
		.select("Command", "Invocation", "Arguments", "Parent")
		.from("data", "Custom_Command_Alias")
		.where("Channel IS NULL")
		.where("User_Alias = %n", userId)
		.where("Name COLLATE utf8mb4_bin = %s", name)
		.limit(1)
		.single()
	)
);

export const getAliasById = async (id: AliasData["ID"]) => {
	const aliasData = await core.Query.getRecordset<AliasData | undefined>(rs => rs
		.select("Command", "Invocation", "Arguments", "Parent")
		.from("data", "Custom_Command_Alias")
		.where("ID = %n", id)
		.limit(1)
		.single()
	);

	return aliasData;
};

export const getAliasByIdAsserted = async (id: AliasData["ID"]) => {
	const aliasData = await getAliasById(id);
	if (!aliasData) {
		throw new SupiError({
		    message: "Assert error: Fetching alias by ID - does not exist",
			args: { id }
		});
	}

	return aliasData;
};

export const getChannelAlias = async (name: string, channelId: Channel["ID"]) => {
	return await core.Query.getRecordset<ChannelAliasData | undefined>(rs => rs
		.select("ID", "Parent")
		.from("data", "Custom_Command_Alias")
		.where("User_Alias IS NULL")
		.where("Channel = %n", channelId)
		.where("Name COLLATE utf8mb4_bin = %s", name)
		.single()
	);
};

export const isClassicAlias = (alias: AliasData): alias is ClassicAliasData => (
	(alias.Command !== null) && (alias.Channel === null) && (alias.User_Alias !== null)
);

export const isLinkedAlias = (alias: AliasData): alias is LinkedAliasData => (
	(alias.Parent !== null) && (alias.Command === null) && (alias.Channel === null) && (alias.User_Alias !== null)
);

export const isChannelAlias = (alias: AliasData): alias is ChannelAliasData => (
	(alias.Parent !== null) && (alias.Command === null) && (alias.Channel !== null) && (alias.User_Alias === null)
);

export const getLinkedAlias = async (parentId: AliasData["ID"]) => {
	const linkedAlias = await core.Query.getRecordset<LinkedAliasData | undefined>(rs => rs
		.select("*")
		.from("data", "Custom_Command_Alias")
		.where("ID = %n", parentId)
		.limit(1)
		.single()
	);

	if (!linkedAlias) {
		throw new SupiError({
		    message: "Assert error: Linked alias does not exist",
			args: { parentId }
		});
	}

	return linkedAlias;
};

export const getGenericAliasRow = async () => (
	await core.Query.getRow<AliasData>("data", "Custom_Command_Alias")
);
export const getClassicAliasRow = async () => (
	await core.Query.getRow<ClassicAliasData>("data", "Custom_Command_Alias")
);
