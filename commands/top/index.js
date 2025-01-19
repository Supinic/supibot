import { connectedChannelGroups } from "./connected-channels.json";

export default {
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
		if (context.platform.Name === "twitch" && !context.params.currentOnly) {
			const previousIDs = await sb.Query.getRecordset(rs => rs
				.select("ID")
				.from("chat_data", "Channel")
				.where("ID <> %n", context.channel.ID)
				.where("Specific_ID = %s", context.channel.Specific_ID)
				.flat("ID")
			);

			for (const previousID of previousIDs) {
				channelIDs.add(previousID);
			}
		}

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
	Dynamic_Description: (async () => [
		"Shows you the top chatters in the current channel.",
		"By default, shows the top 10 - but you can choose any number between 1 and 100.",
		"In the case you select more users than 10-20, I recommend piping the output to $pbp or $hbp for ease of use.",
		"",

		`<code>$top</code>`,
		"Shows the top 10 users in the current channel, sorted by posted chat lines.",
		"",

		`<code>$top (number)</code>`,
		`<code>$top 5</code>`,
		"Shows a different number of top users, based on your selected amount.",
		"",

		`<code>$top currentOnly:true</code>`,
		"Instead of using all previous channels' data (e.g. when it was renamed), this parameter will force it so only the current is used.",
		"E.g.: If you're in channel @Pepega, but the channel renamed from @PepeHands in the past, this command will only show the top chatters in @Pepega.",
		"By default, the command shows you data from all channels."
	])
};
