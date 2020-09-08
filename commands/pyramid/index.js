module.exports = {
	Name: "pyramid",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 60000,
	Description: "Creates a pyramid in chat. Only usable in chats where Supibot is a VIP or a Moderator.",
	Flags: ["mention","pipe","whitelist"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function pyramid (context, emote, size = 3) {
		if (context.channel.Mode !== "Moderator" && context.channel.Mode !== "VIP") {
			return { reply: "Cannot create pyramids in a non-VIP/Moderator chat!" };
		}
		else if (!emote) {
			return { reply: "No emote provided!" };
		}
		else if (emote.repeat(size) > context.channel.Message_Limit || size > 20) {
			return { reply: "Target pyramid is either too wide or too tall!" };
		}
	
		emote += " ";
		
		for (let i = 1; i <= size; i++) {
			context.channel.send(emote.repeat(i));
		}
	
		for (let i = (size - 1); i > 0; i--) {
			context.channel.send(emote.repeat(i));
		}
		
		return null;
	}),
	Dynamic_Description: null
};