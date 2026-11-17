import type { BadAppleSubcommandDefinition } from "../index.ts";

export default {
	name: "list",
	aliases: ["show"],
	title: "Post the list link",
	getDescription: (prefix) => [
		`<code>${prefix}bar list</code>`,
		`<code>${prefix}bar show</code>`,
		"Posts the link to the Bad Apple!! list: https://supinic.com/data/bad-apple/list"
	],
	default: false,
	execute: () => ({
		success: true,
		reply: `https://supinic.com/data/bad-apple/list`
	})
} satisfies BadAppleSubcommandDefinition;
