module.exports = {
	Name: "externalbot",
	Aliases: ["ebot"],
	Author: "supinic",
	Cooldown: 0,
	Description: "Makes supibot execute a command of a different bot, and then the result will be that bot's command response. As such, this command can only be used in a pipe.",
	Flags: ["external-input","mention","pipe","whitelist"],
	Params: null,
	Whitelist_Response: "Currently being tested, and only available to trusted developers",
	Static_Data: (() => ({
		responseTimeout: 10_000
	})),
	Code: (async function externalBot (context, ...rest) {
		if (!context.channel) {
			return {
				reply: "Can't use this command in PMs!"
			};
		}
		else if (!context.append.pipe) {
			return {
				reply: "Can't use this command outside of pipe!"
			};
		}

		if (!this.data.prefixes) {
			this.data.prefixes = await sb.Query.getRecordset(rs => rs
				.select("Bot_Alias", "Prefix")
				.from("bot_data", "Bot")
				.where("Prefix IS NOT NULL")
				.orderBy("LENGTH(Prefix) DESC")
			);
		}

		let botData = null;
		const message = rest.join(" ");
		for (const { Prefix: prefix, Bot_Alias: botID } of this.data.prefixes) {
			if (message.startsWith(prefix)) {
				botData = await sb.User.get(botID);
				break;
			}
		}

		if (!botData) {
			return {
				success: false,
				reason: "bad_invocation",
				reply: "No bot with that prefix has been found!"
			};
		}
		else if (botData.Name === context.platform.Self_Name) {
			return {
				success: false,
				reason: "bad_invocation",
				reply: "I'm not an external bot! 😠"
			};
		}

		if (context.platform.userMessagePromises.get(context.channel.ID)?.get(botData.ID)) {
			return {
				success: false,
				reply: `Already awaiting response from ${botData.Name} in this channel!`
			};
		}

		// Sends the actual external bot's command, and wait to see if it responds
		const safeMessage = await context.platform.prepareMessage(message, context.channel);
		const messagePromise = context.channel.waitForUserMessage(botData);

		await context.channel.send(safeMessage);

		const result = await messagePromise;
		if (result === null) {
			return {
				reason: "bad_invocation",
				reply: `No response from external bot after ${this.staticData.responseTimeout / 1000} seconds!`
			};
		}

		const selfRegex = new RegExp(`^@?${context.platform.Self_Name},?`, "i");
		return {
			reply: result.message.replace(selfRegex, "")
		};
	}),
	Dynamic_Description: null
};
