module.exports = {
	Name: "whatemoteisit",
	Aliases: ["weit"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "What emote is it? Posts specifics about a given Twitch subscriber emote.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "linkOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function whatEmoteIsIt (context, emote) {
		const { statusCode, body: response } = await sb.Got("Leppunen", {
			url: `twitch/emotes/${emote}`,
			throwHttpErrors: false
		});

		if (statusCode >= 500) {
			const { error } = response;
			await sb.Platform.get("twitch").pm(
				`twitch/emotes API failed for emote "${emote}" - server error ${statusCode}: ${error}`,
				"leppunen"
			);

			return {
				success: false,
				reply: `API failed with error ${statusCode}: ${error}!`
			};
		}
		else if (statusCode !== 200) {
			return {
				success: false,
				reply: response.error
			};
		}

		const { channel, channelid: cid, emotecode, emoteid, channellogin: login, tier } = response;
		const originID = await sb.Query.getRecordset(rs => rs
			.select("ID")
			.from("data", "Origin")
			.where("Emote_ID = %s", emoteid)
			.limit(1)
			.single()
			.flat("ID")
		);

		const emoteLink = `https://twitchemotes.com/emotes/${emoteid}`;
		const cdnLink = `https://static-cdn.jtvnw.net/emoticons/v1/${emoteid}/3.0`;
		if (context.params.linkOnly) {
			return {
				reply: cdnLink
			};
		}

		let tierString;
		if (tier && login) {
			let channelString = `@${channel}`;
			if (channel.toLowerCase() !== login.toLowerCase()) {
				channelString = `@${login} (${channel})`;
			}

			tierString = `tier ${tier} sub emote to channel ${channelString}`;
		}
		else {
			tierString = `special ${channel} emote`;
		}

		const originString = (originID)
			? `This emote has origin info - use the ${sb.Command.prefix}origin command.`
			: "";

		return {
			reply: (channel)
				? `${emotecode} (ID ${emoteid}) - ${tierString}. ${emoteLink} ${cdnLink} ${originString}`
				: `${emotecode} (ID ${emoteid}) - global Twitch emote. ${emoteLink} https://twitchemotes.com/channels/${cid} ${cdnLink} ${originString}`
		};
	}),
	Dynamic_Description: null
};
