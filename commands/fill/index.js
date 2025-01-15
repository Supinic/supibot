module.exports = {
	Name: "fill",
	Aliases: null,
	Author: "supinic",
	Cooldown: 20000,
	Description: "Takes the input and scrambles it around randomly, filling the message. In live streams, there is less text and the cooldown is increased to reduce spam.",
	Flags: ["pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function fill (context, ...words) {
		if (words.length === 0) {
			return {
				reply: "At least one word must be provided!"
			};
		}

		let length = 0;
		const result = [];

		let live = false;
		let limit = (context.channel?.Message_Limit ?? context.platform.Message_Limit);
		if (context.channel) {
			const isLive = await context.channel.isLive();
			if (isLive) {
				limit = Math.trunc(limit / 2);
				live = true;
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
				length: (live && !context.append.pipe)
					? 60_000 // 1 minute
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
