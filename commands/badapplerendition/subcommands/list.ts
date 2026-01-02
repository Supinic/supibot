import type { BadAppleSubcommandDefinition } from "../index.js";

export default {
	name: "list",
	aliases: ["show"],
	title: "Post the list link",
	description: ["Simply posts the link to the Bad Apple!! list."],
	default: false,
	execute: () => ({
		reply: `https://supinic.com/data/bad-apple/list`
	})
} satisfies BadAppleSubcommandDefinition;
