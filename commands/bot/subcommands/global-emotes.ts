import type { BotSubcommandDefinition } from "../index.ts";

export default {
	name: "global-emotes",
	title: "Disable/enable global Discord emotes usage",
	aliases: ["enable-global-emotes", "disable-global-emotes"],
	getDescription: (prefix) => [
		`<code>${prefix}bot disable-global-emotes channel:(channel)</code>`,
		`<code>${prefix}bot enable-global-emotes channel:(channel)</code>`,
		"Disables (or re-enables, respectively) the automatic usage of global Discord emotes in the current channel.",
		"Supibot has access to all emotes from all servers it's on, and these might prove to be annoying somewhat.",
		"This configuration lets you disable those, only the ones from the current server will be used."
	],
	execute: async ({ context }, subcommand) => {
		const { params } = context;
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const channelData = (params.channel) ? sb.Channel.getAsserted(params.channel) : context.channel!;
		if (subcommand === "global-emotes") {
			return {
				success: false,
				reply: `Use "$bot enable-global-emotes" or "$bot disable-global-emotes" instead!`
			};
		}

		if (channelData.Platform.Name !== "discord") {
			return {
				success: false,
				reply: `Cannot set the global emotes configuration in channels outside of Discord!`
			};
		}

		const action = subcommand.replace("-global-emotes", "") as "enable" | "disable";
		const currentValue = await channelData.getDataProperty("disableDiscordGlobalEmotes");
		if ((currentValue === true && action === "enable") || (!currentValue && action === "disable")) {
			return {
				success: false,
				reply: `Global emotes are already ${action}d in this channel!`
			};
		}

		const newValue = !currentValue;
		await channelData.setDataProperty("disableDiscordGlobalEmotes", newValue);
		const verb = (newValue) ? "disabled" : "re-enabled";

		return {
			success: true,
			reply: `Global emotes have been ${verb} in this channel successfully.`
		};
	}
} satisfies BotSubcommandDefinition;
