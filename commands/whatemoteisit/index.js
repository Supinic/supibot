module.exports = {
	Name: "whatemoteisit",
	Aliases: ["weit"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "What emote is it? Posts specifics about a given Twitch subscriber emote.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function whatEmoteIsIt (context, emote) {
		const data = await sb.Got("Leppunen", "twitch/emotes/" + emote).json();
		const {error, channel, channelid, emoteid, emotecode, tier} = data;
		if (error) {
			return { reply: error + "!" };
		}
	
		const originID = await sb.Query.getRecordset(rs => rs
		    .select("ID")
		    .from("data", "Origin")
			.where("Emote_ID = %s", emoteid)
			.limit(1)
			.single()
			.flat("ID")
		);
	
		const emoteLink = "https://twitchemotes.com/emotes/" + emoteid;
		const originString = (originID)
			? `This emote has origin info - use the ${sb.Command.prefix}origin command.`
			: "";
	
		return {
			reply: (channel)
				? `${emotecode} (ID ${emoteid}) - tier ${tier} sub emote to channel #${channel.toLowerCase()}. ${emoteLink} ${originString}`
				: `${emotecode} (ID ${emoteid}) - global Twitch emote. ${emoteLink} ${originString}`
		};
	
	}),
	Dynamic_Description: null
};