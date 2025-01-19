export default {
	name: "offline-only",
	aliases: ["enable-offline-only", "disable-offline-only"],
	description: [
		`<code>$bot offline-only</code>`,
		`<code>$bot disable-offline-only</code>`,
		`<code>$bot offline-only channel:(name)</code>`,
		"Activates (or deactivates, if used with disable-) the offline-only mode, which will make Supibot unresponsive in the channel when the streamer goes live.",
		"After the stream ends, Supibot will automatically reactivate. There might be delay up to 2 minutes for both online/offline events.",
		"Note: The stream must go online/offline for this mode to activate. If it is already live, Supibot won't deactivate until it goes live again in the future."
	],
	execute: async (context, options = {}) => {
		const { channelData, subcommand } = options;
		if (subcommand === "offline-only") {
			return {
				success: false,
				reply: `Use "$bot enable-offline-only" or "$bot disable-offline-only" instead!`
			};
		}

		const moduleData = sb.ChatModule.get("offline-only-mode");
		const existingModuleCheck = await sb.Query.getRecordset(rs => rs
			.select("1")
			.from("chat_data", "Channel_Chat_Module")
			.where("Channel = %n", channelData.ID)
			.where("Chat_Module = %s", moduleData.Name)
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

			const row = await sb.Query.getRow("chat_data", "Channel_Chat_Module");
			row.setValues({
				Channel: channelData.ID,
				Chat_Module: moduleData.Name
			});

			await row.save();
			await sb.Channel.reloadSpecific(channelData);

			return {
				reply: `Channel ${channelData.Name} is now in offline-only mode.`
			};
		}
		else if (subcommand === "disable-offline-only") {
			if (!existingModuleCheck) {
				return {
					success: false,
					reply: `The offline-only mode has not been activated in channel "${channelData.Name}" before, so you can't disable it!`
				};
			}

			await sb.Query.getRecordDeleter(rd => rd
				.delete()
				.from("chat_data", "Channel_Chat_Module")
				.where("Channel = %n", channelData.ID)
				.where("Chat_Module = %s", moduleData.Name)
			);

			await sb.Channel.reloadSpecific(channelData);
			return {
				reply: `Channel ${channelData.Name} is now no longer in offline-only mode.`
			};
		}
	}
};
