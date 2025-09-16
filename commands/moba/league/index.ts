import { SubcommandCollection } from "../../../classes/command.js";
import { type MobaGameDefinition, MobaSubcommandDefinition } from "../index.js";

import LastMatchCommand from "./last-match.js";
import RankCommand from "./rank.js";

const subcommands = [
	LastMatchCommand,
	RankCommand
] satisfies MobaSubcommandDefinition[];

const subcommandCollection = new SubcommandCollection("league", subcommands);
export default {
	requiredEnvs: ["API_RIOT_GAMES_KEY"],
	subcommandCollection,
	addendum: [
		"To simplify usage for <code>$league</code>, you can use the <code>$set</code> command to set your region and username:",
		"<code>$set league-user (username)</code>",
		"<code>$set league-region (region)</code>",
		`Check more info on the <a href="/bot/command/detail/set">$set command's help page</a>`,
		"",

		"Once you have both of these set up, you can omit the region and username in <code>$league</code> commands.",
		"You can also check someone else's stats by using their username with the <code>@</code> symbol.",
		"<code>$league</code> → Your stats",
		"<code>$league @Username</code> → Another user's stats"
	]
} satisfies MobaGameDefinition;
