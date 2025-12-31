import type { CheckSubcommandDefinition } from "../index.js";

export default {
	name: "slots",
	title: "Leaderboard of the $slots command",
	aliases: [],
	default: false,
	description: ["Posts the link to all winners for the slots command."],
	execute: () => ({
		success: true,
		reply: `Check all winners here: https://supinic.com/data/slots-winner/leaderboard`
	})
} satisfies CheckSubcommandDefinition;
