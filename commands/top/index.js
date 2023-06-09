module.exports = {
	Name: "top",
	Aliases: null,
	Author: "supinic",
	Cooldown: 60000,
	Description: "Posts the top X (implicitly 10) users by chat lines sent in the context of the current channel.",
	Flags: ["mention"],
	Params: [
		{ name: "previousChannel", type: "string" }
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

		let channelData = context.channel;
		if (context.param.previousChannel) {
			if (context.platform.Name !== "twitch") {
				return {
					success: false,
					reply: `Checking previous channels' top data is only available on Twitch!`
				};
			}
			
			const previousChannelData = sb.Channel.get(context.param.previousChannel, context.platform);
			if (!previousChannelData) {
				return {
					success: false,
					reply: `You gave me a channel that I have never been in!`
				};
			}

			if (context.channel.Specific_ID !== previousChannelData.Specific_ID) {
				return {
					success: false,
					reply: `The channel you gave me isn't the same as this one! The user IDs have to match`
				};
			}

			channelData = previousChannelData;
		}

		const limit = Number(rawLimit);
		if (!sb.Utils.isValidInteger(limit)) {
			return {
				success: false,
				reply: "The limit must be provided as a number!",
				cooldown: 5000
			};
		}
		else if (limit > 10) {
			return {
				success: false,
				reply: "Limit set too high! Use a value between 1 and 10!",
				cooldown: 5000
			};
		}

		const channels = (channelData.ID === 7 || channelData.ID === 8)
			? [7, 8, 46]
			: [channelData.ID];

		const top = await sb.Query.getRecordset(rs => rs
			.select("SUM(Message_Count) AS Total")
			.select("User_Alias.Name AS Name")
			.from("chat_data", "Message_Meta_User_Alias")
			.join("chat_data", "User_Alias")
			.where("Channel IN %n+", channels)
			.groupBy("User_Alias")
			.orderBy("SUM(Message_Count) DESC")
			.limit(limit)
		);

		const chatters = top.map((i, ind) => {
			const name = `${i.Name[0]}\u{E0000}${i.Name.slice(1)}`;
			return `#${ind + 1}: ${name} (${sb.Utils.groupDigits(i.Total)})`;
		}).join(", ");

		return {
			meta: {
				skipWhitespaceCheck: true
			},
			reply: `Top ${limit} chatters: ${chatters}`
		};
	}),
	Dynamic_Description: null
};
