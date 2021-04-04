module.exports = {
	Name: "fill",
	Aliases: null,
	Author: "supinic",
	Cooldown: 20000,
	Description: "Takes the input and scrambles it around randomly.",
	Flags: ["pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function fill (context, ...words) {
		if (words.length === 0) {
			return {
				reply: "At least one word must be provided!"
			};
		}
	
		let length = 0;
		const result = [];
		let limit = (context.channel?.Message_Limit ?? context.platform.Message_Limit);
		if (context.channel)  {
			const streamData = await context.channel.getStreamData();
			if (streamData.live) {
				limit = Math.trunc(limit / 2);
			}
		}
	
		while (length < limit) {
			const randomWord = sb.Utils.randArray(words);
			result.push(randomWord);
			length += randomWord.length + 1;
		}
	
		let cooldown;
		if (context.channel === null) {
			cooldown = { length: 10000 };
		}
		else {
			cooldown = {
				user: null,
				channel: context.channel.ID,
				length: (context.channel.sessionData?.live && !context.append.pipe)
					? 60.0e3 // 1 minute
					: this.Cooldown
			};
		}
	
		return {
			reply: result.slice(0, -1).join(" "),
			cooldown
		};
	}),
	Dynamic_Description: null
};