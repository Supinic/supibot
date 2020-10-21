module.exports = {
	Name: "firstline",
	Aliases: ["fl"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts the target user's first chat line in the context of the current channel, and the date they sent it.",
	Flags: ["mention","opt-out","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function firstLine (context, user) {
		if (!context.channel) {
			return {
				reply: "Not available in private messages!"
			};
		}
		
		let targetUser = null;
		if (!user) {
			targetUser = context.user;
		}
		else if (context.platform.Name === "discord") {
			targetUser = await sb.Utils.getDiscordUserDataFromMentions(user, context.append);
		}
	
		targetUser = await sb.User.get(targetUser || user, true);
	
		if (!targetUser) {
			return { reply: "User not found in the database!" };
		}
	
		let check = null;
		if ([7, 8, 46].includes(context.channel.ID)) {
			check = (await sb.Query.getRecordset(rs => rs
				.select("1")
				.from("chat_data", "Message_Meta_User_Alias")
				.where("User_Alias = %n", targetUser.ID)
				.where("Channel IN (7, 8, 46)")
			))[0];
		}
		else {
			check = (await sb.Query.getRecordset(rs => rs
				.select("1")
				.from("chat_data", "Message_Meta_User_Alias")
				.where("User_Alias = %n", targetUser.ID)
				.where("Channel = %n", context.channel.ID)
			))[0];
		}
		if (!check) {
			return { reply: "That user has not said anything in this channel!" };
		}
	
		let line = null;
		if ([7, 8, 46].includes(context.channel.ID)) {
			const channels = [7, 8, 46].map(i => sb.Channel.get(i));
			line = (await Promise.all(channels.map(async channel => sb.Query.getRecordset(rs => rs
				.select("Text", "Posted")
				.from("chat_line", channel.getDatabaseName())
				.where("User_Alias = %n", targetUser.ID)
				.orderBy("ID ASC")
				.limit(1)
			)))).filter(i => Boolean(i[0]));
			
			line.sort((a, b) => {
				a = (a[0] && a[0].Posted) || 0;
				b = (b[0] && b[0].Posted) || 0;
				return (a - b);
			})[0];
	
			if (!line) {
				return { reply: "No chat lines found?!" };
			}
			line = line[0][0];
		}
		else {
			line = (await sb.Query.getRecordset(rs => rs
				.select("Text", "Posted")
				.from("chat_line", context.channel.getDatabaseName())
				.where("User_Alias = %n", targetUser.ID)
				.orderBy("ID ASC")
				.limit(1)
			))[0];
		}
	
		if (!line) {
			return { reply: "No chat lines found?!" };
		}
		const prefix = (targetUser.ID === context.user.ID) ? "Your" : "That user's";
	
		return {
			partialReplies: [
				{
					bancheck: false,
					message: `${prefix} first message in this channel was (${sb.Utils.timeDelta(line.Posted)}):`
				},
				{
					bancheck: true,
					message: line.Text
				}
			]
		};
	}),
	Dynamic_Description: null
};