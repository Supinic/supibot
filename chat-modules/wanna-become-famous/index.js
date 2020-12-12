module.exports = {
	Name: "wanna-become-famous",
	Events: ["message"],
	Description: "Bans bots that spam the follower site promotion",
	Code: (async function wannaBecomeFamous (context) {
		if (context.channel.Platform.Name !== "twitch") {
			return; // cannot timeout when not on twitch
		}

		const msg = sb.Utils.removeAccents(context.message).toLowerCase();
		if (!msg.includes("wanna become famous?") || !msg.includes("bigfollows")) {
			return;
		}

		const { client } = context.channel.Platform;
		if (!context.user && context.raw?.user) {
			const name = context.raw.user;
			await client.privmsg(context.channel.Name, `/ban ${name}`);
			await channelData.send("NOIDONTTHINKSO I don't wanna become famous");

			return;
		}
		
		const messageCount = await sb.Query.getRecordset(rs => rs
		    .select("Message_Count")
		    .from("chat_data", "Message_Meta_User_Alias")
			.where("Channel = %n", context.channel.ID)
			.where("User_Alias = %n", context.user.ID)
			.single()
			.flat("Message_Count")
		);

		if (typeof messageCount === "undefined" || messageCount <= 1) {
			await client.privmsg(context.channel.Name, `/ban ${context.user.Name}`);
			await channelData.send("NOIDONTTHINKSO");
		}
	}),
	Author: "supinic"
};