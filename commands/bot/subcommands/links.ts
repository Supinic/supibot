import { type BotSubcommandDefinition } from "../index.ts";

export default {
	name: "links",
	title: "Enable/disable auto-removing links from responses",
	aliases: ["enable-links", "disable-links"],
	getDescription: (prefix) => [
		`<code>${prefix}bot enable-links</code>`,
		`<code>${prefix}bot disable-links</code>`,
		`<code>${prefix}bot enable-links channel:(channel)</code>`,
		`<code>${prefix}bot disable-links channel:(channel)</code>`,
		"Disables or enables automatic replacement of all links in a channel.",
		`If enabled, all links will be replaced by "[LINK]" or a similar placeholder.`
	],
	execute: async ({ context }, subcommand) => {
		const { params } = context;
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const channelData = (params.channel) ? sb.Channel.getAsserted(params.channel) : context.channel!;
		if (subcommand === "links") {
			return {
				success: false,
				reply: `Use "$bot enable-links" or "$bot disable-links" instead!`
			};
		}

		const action = subcommand.replace("-links", "") as "enable" | "disable";
		const current = channelData.Links_Allowed;

		if ((current && action === "enable") || (!current && action === "disable")) {
			return {
				success: false,
				reply: `Links are already ${action}d in channel "${channelData.Name}"!`
			};
		}

		await channelData.saveProperty("Links_Allowed", !current);

		return {
			success: true,
			reply: `Links are now ${action}d in channel "${channelData.Name}".`
		};
	}
} satisfies BotSubcommandDefinition;
