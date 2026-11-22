import { SupiError } from "supi-core";
import LeagueGameDefinition from "./league/index.ts";
import {
	declare,
	type CommandDefinition,
	type SubcommandCollection,
	type SubcommandDefinition
} from "../../classes/command.ts";

export type MobaGameDefinition = {
	requiredEnvs: string[];
	subcommandCollection: SubcommandCollection;
	addendum?: string[]
};

const MOBA_COMMAND_PARAMS = [{ name: "rawData", type: "boolean" }] as const;
const GAMES: Partial<Record<string, MobaGameDefinition>> = {
	league: LeagueGameDefinition
};

export type MobaCommandShape = CommandDefinition<typeof MOBA_COMMAND_PARAMS>;
export type MobaSubcommandDefinition = SubcommandDefinition<MobaCommandShape>;

const mobaCommandDefinition = declare({
	Name: "moba",
	Aliases: ["league", "dota"],
	Cooldown: 10000,
	Description: "This command lets you check many things related to several MOBA games - League of Legends ($league).",
	Flags: ["mention", "pipe", "skip-banphrase"],
	Params: MOBA_COMMAND_PARAMS,
	Whitelist_Response: null,
	Code: (async function moba (context, command, ...args) {
		if (context.invocation === "moba") {
			return {
				success: false,
				reply: `Use one of the command aliases directly!`
			};
		}

		const game = GAMES[context.invocation];
		if (!game) {
			return {
				success: false,
				reply: `This game is not implemented yet!`
			};
		}

		const hasEnvs = game.requiredEnvs.every(key => process.env[key]);
		if (!hasEnvs) {
			throw new SupiError({
				message: `Missing key(s) for ${context.invocation} (${game.requiredEnvs.join(", ")})`
			});
		}

		const { subcommandCollection } = game;
		const subcommand = subcommandCollection.get(command);
		if (subcommand) {
			return await subcommand.execute.call(this, { context }, command, ...args);
		}
		else {
			const defaultSubcommand = subcommandCollection.default;
			return await defaultSubcommand.execute.call(this, { context }, defaultSubcommand.name, command, ...args);
		}
	}),
	Dynamic_Description: async () => {
		const list = [];
		for (const [game, definition] of Object.entries(GAMES)) {
			if (!definition) {
				continue;
			}

			const { addendum, subcommandCollection } = definition;
			const description = await subcommandCollection.createDescription();

			list.push(`<h5>$${game}</h5>`, ...description);

			if (addendum) {
				list.push(...addendum);
			}
		}

		return [
			"This command lets you check many things related to many MOBA games.",
			"",

			...list
		];
	}
}) satisfies MobaCommandShape;

export default mobaCommandDefinition;
