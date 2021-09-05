module.exports = {
	Name: "top",
	Aliases: null,
	Author: "supinic",
	Cooldown: 60000,
	Description: "Posts the top X (implicitly 10) users by chat lines sent in the context of current channel.",
	Flags: ["mention"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function top (context, rawLimit) {
		if (!context.channel) {
			return {
				success: false,
				reply: `This command is not available here!`
			};
		}

		const permissions = await context.user.getUserPermissions();
		if (permissions.flag === sb.User.permissions.regular) {
			return {
				success: false,
				reply: `You're not allowed to use this command here! Only administrators, channel owners and channel ambassadors can.`
			};
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

		const channels = (context.channel.ID === 7 || context.channel.ID === 8)
			? [7, 8, 46]
			: [context.channel.ID];

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
