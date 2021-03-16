module.exports = {
	Name: "supinicblogpost",
	Aliases: ["sbp"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts the timestamp and link of the latest blogpost Supinic keeps up on his Discord.",
	Flags: ["mention","use-params"],
	Params: [
		{ name: "fullResponse", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		channel: "748955843415900280"
	})),
	Code: (async function supinicBlogPost (context) {
		const client = sb.Platform.get("discord").client;
		const channel = await client.channels.fetch(this.staticData.channel);
		const messageID = channel.lastMessageID;
		if (!messageID) {
			return {
				success: false,
				reply: `No latest messages found!`
			};
		}

		const messageData = await channel.messages.fetch(messageID);
		const date = new sb.Date(messageData.createdTimestamp);
		if (context.params.fullResponse) {
			const text = messageData.content.replace(/<@&\d+>\s*/g, "");
			const paste = await sb.Pastebin.post(text, {
				name: "Supibot update post " + date.format("Y-m-d"),
				format: "markdown"
			});

			return {
				reply: paste
			};
		}
		
		return {
			reply: sb.Utils.tag.trim `
				The last Supibot update was posted ${sb.Utils.timeDelta(date)}.
				Check it out here:
				${messageData.url}
			`
		};

	}),
	Dynamic_Description: (async (prefix) => {
		return [
			`<code>${prefix}sbp</code>`,
			`<code>${prefix}supinicblogpost</code>`,
			"Posts the time of posting, and the direct link to the message on Discord.",
			"",

			`<code>${prefix}sbp fullResponse:true</code>`,
			"Posts a Pastebin link to the full message."
		]
	})
};