module.exports = {
	Name: "top",
	Aliases: null,
	Author: "supinic",
	Cooldown: 60000,
	Description: "Posts the top X (implicitly 10) users by chat lines sent in the context of the current channel.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "currentOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function top (context, rawLimit) {
		if (!context.channel) {
			return {
				success: false,
				reply: `This command is not available here!`
			};
		}

		const permissions = await context.getUserPermissions();
		if (permissions.flag === sb.User.permissions.regular) {
			return {
				success: false,
				reply: `You're not allowed to use this command here! Only administrators, channel owners and channel ambassadors can.`
			};
		}

		let limit = Number(rawLimit);
		if (!sb.Utils.isValidInteger(limit)) {
			limit = 10;
		}
		else if (limit > 100) {
			return {
				success: false,
				reply: "You provided a limit that's too high! Use a value between 1 and 100 instead.",
				cooldown: 5000
			};
		}

		const channelIDs = new Set([context.channel.ID]);
		if (context.platform.Name === "twitch" && !context.platform.currentOnly) {
			const previousIDs = await sb.Query.getRecordset(rs => rs
				.select("ID")
				.from("chat_data", "Channel")
				.where("ID <> %n", context.channel.ID)
				.where("Specific_ID = %s", context.channel.Specific_ID)
				.flat("ID"));

			for (const previousID of previousIDs) {
				channelIDs.add(previousID);
			}
		}

		const { connectedChannelGroups } = require("./connected-channels.json");
		const group = connectedChannelGroups.find(i => i.includes(context.channel.ID));
		if (group) {
			for (const channelID of group) {
				channelIDs.add(channelID);
			}
		}

		const top = await sb.Query.getRecordset(rs => rs
			.select("SUM(Message_Count) AS Total")
			.select("User_Alias.Name AS Name")
			.from("chat_data", "Message_Meta_User_Alias")
			.join("chat_data", "User_Alias")
			.where("Channel IN %n+", [...channelIDs])
			.groupBy("User_Alias")
			.orderBy("SUM(Message_Count) DESC")
			.limit(limit));

		const chatters = top.map((i, ind) => {
			const name = `${i.Name[0]}\u{E0000}${i.Name.slice(1)}`;
			return `#${ind + 1}: ${name} (${sb.Utils.groupDigits(i.Total)})`;
		})
			.join(", ");

		return {
			meta: {
				skipWhitespaceCheck: true
			},
			reply: `Top ${limit} chatters: ${chatters}`
		};
	}),
	Dynamic_Description: null
};
