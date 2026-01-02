import type { CheckSubcommandDefinition } from "../index.js";

export default {
	name: "slots",
	title: "Leaderboard of the $slots command",
	aliases: [],
	description: [],
	getDescription: (prefix) => [
		`<code>${prefix}check slots</code>`,
		`Posts the link to all winners for the <a href="/bot/command/detail/slots">${prefix}slots</a> command.`
	],
	execute: () => ({
		success: true,
		reply: `Check all winners here: https://supinic.com/data/slots-winner/leaderboard`
	})
} satisfies CheckSubcommandDefinition;
