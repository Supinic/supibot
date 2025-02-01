export default {
	name: "no-abb-chatter",
	aliases: [],
	parameter: "arguments",
	description: `Removes you as a possible target for the "$abb chatter" command.`,
	pipe: true,
	flags: {
		pipe: false
	},
	set: async (context) => {
		const row = await sb.Query.getRow("chat_data", "User_Alias_Data");
		await row.load({
			User_Alias: context.user.ID,
			Property: "noAbbChatter"
		}, true);

		if (row.loaded) {
			return {
				success: false,
				reply: `You are already exempt from the "$abb chatter" command!`
			};
		}

		row.setValues({
			User_Alias: context.user.ID,
			Property: "noAbbChatter",
			Value: true
		});

		await row.save({ skipLoad: true });

		return {
			reply: `You are now exempt from the "$abb chatter" command.`
		};
	},
	unset: async (context) => {
		const row = await sb.Query.getRow("chat_data", "User_Alias_Data");
		await row.load({
			User_Alias: context.user.ID,
			Property: "noAbbChatter"
		}, true);

		if (!row.loaded) {
			return {
				success: false,
				reply: `You are not exempt from the "$abb chatter" command!`
			};
		}

		await row.delete();

		return {
			reply: `You are no longer exempt from the "$abb chatter" command.`
		};
	}
};
