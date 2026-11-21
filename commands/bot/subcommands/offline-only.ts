import type { BotSubcommandDefinition } from "../index.ts";

export default {
	name: "offline-only",
	title: "Enable/disable offline-only mode",
	aliases: ["enable-offline-only", "disable-offline-only"],
	description: [
		`<code>$bot offline-only</code>`,
		`<code>$bot disable-offline-only</code>`,
		`<code>$bot offline-only channel:(name)</code>`,
		"Activates (or deactivates, if used with disable-) the offline-only mode, which will make Supibot unresponsive in the channel when the streamer goes live.",
		"After the stream ends, Supibot will automatically reactivate. There might be delay up to 2 minutes for both online/offline events.",
		"Note: The stream must go online/offline for this mode to activate. If it is already live, Supibot won't deactivate until it goes live again in the future."
	],
	execute: async (context, subcommand) => { // @todo `subcommand` could be based on `name` + `aliases` types as union
		const { params } = context;
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const channelData = (params.channel) ? sb.Channel.getAsserted(params.channel) : context.channel!;
		if (subcommand === "offline-only") {
			return {
				success: false,
				reply: `Use "$bot enable-offline-only" or "$bot disable-offline-only" instead!`
			};
		}

		const moduleData = sb.ChatModule.getAsserted("offline-only-mode");
		// Guaranteed numeric 1 or undefined
		const existingModuleCheck = await core.Query.getRecordset<1 | undefined>(rs => rs
			.select("1")
			.from("chat_data", "Channel_Chat_Module")
			.where("Channel = %n", channelData.ID)
			.where("Chat_Module = %s", moduleData.name)
			.single()
			.flat("1")
		);

		if (subcommand === "enable-offline-only") {
			if (existingModuleCheck) {
				return {
					success: false,
					reply: `The offline-only mode has already been activated in channel "${channelData.Name}"!`
				};
			}

			const row = await core.Query.getRow("chat_data", "Channel_Chat_Module");
			row.setValues({
				Channel: channelData.ID,
				Chat_Module: moduleData.name
			});

			await row.save();
			await sb.Channel.reloadSpecific(channelData);

			return {
				success: true,
				reply: `Channel ${channelData.Name} is now in offline-only mode.`
			};
		}
		else {
			if (!existingModuleCheck) {
				return {
					success: false,
					reply: `The offline-only mode has not been activated in channel "${channelData.Name}" before, so you can't disable it!`
				};
			}

			await core.Query.getRecordDeleter(rd => rd
				.delete()
				.from("chat_data", "Channel_Chat_Module")
				.where("Channel = %n", channelData.ID)
				.where("Chat_Module = %s", moduleData.name)
			);

			await sb.Channel.reloadSpecific(channelData);

			return {
				success: true,
				reply: `Channel ${channelData.Name} is now no longer in offline-only mode.`
			};
		}
	}
} satisfies BotSubcommandDefinition;
