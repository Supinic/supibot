module.exports = {
	Name: "wanna-become-famous",
	Events: ["message"],
	Description: "Bans various spam or follow bots.",
	Code: (async function wannaBecomeFamous (context) {
		if (context.channel.mode === "Read") {
			return;
		}
		else if (context.channel.Platform.Name !== "twitch") {
			return; // cannot timeout when not on twitch
		}

		let type = "";
		const msg = sb.Utils.removeAccents(context.message).toLowerCase();
		if (msg.includes("become famous?") && msg.includes("bigfollows")) {
			type = "becoming famous";
		}
		else if (msg.includes("get raided")) {
			type = "getting raided";
		}
		else if (msg.includes("buy followers")) {
			type = "buying followers";
		}
		else {
			return;
		}

		const { client } = context.channel.Platform;
		const emote = await context.channel.getBestAvailableEmote(["NOIDONTTHINKSO", "forsenSmug", "supiniNOIDONTTHINKSO", "RarePepe"], "😅");
		if (!context.user && context.raw?.user) {
			const name = context.raw.user;
			await client.ban(context.channel.Name, name, type);
			await context.channel.send(`${emote} ${type}`);

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
			await client.ban(context.channel.Name, context.user.Name, type);
			await context.channel.send(`${emote} ${type} again`);
		}
	}),
	Author: "supinic"
};
