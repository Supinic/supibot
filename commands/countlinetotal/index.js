module.exports = {
	Name: "countlinetotal",
	Aliases: ["clt"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Fetches the number of data lines from ALL the log tables Supibot uses, including the total size and a prediction of when the storage will run out.",
	Flags: ["mention"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function countLineTotal (context) {
		const chatLineAmount = await sb.Query.getRecordset(rs => rs
			.select("SUM(AUTO_INCREMENT) AS Chat_Lines")
			.from("INFORMATION_SCHEMA", "TABLES")
			.where("TABLE_SCHEMA = %s", "chat_line")
			.flat("Chat_Lines")
			.single()
		);

		let historyText = "";
		const cacheKey = "count-line-total-previous";
		const history = await sb.Cache.getByPrefix(cacheKey);
		if (history) {
			const days = (sb.Date.now() - history.timestamp) / 864e5;
			const linesPerHour = sb.Utils.round((chatLineAmount - history.amount) / (days * 24), 0);

			historyText = `Lines are added at a rate of ${sb.Utils.groupDigits(linesPerHour)} lines/hr.`;
		}
		else {
			const value = {
				timestamp: sb.Date.now(),
				amount: chatLineAmount
			};

			await sb.Cache.setByPrefix(cacheKey, value, {
				expiry: 365 * 864e5 // 1 year (365 days)
			});
		}

		const cooldown = {};
		if (context.channel) {
			cooldown.user = null;
			cooldown.channel = context.channel.ID;
			cooldown.length = this.Cooldown;
		}
		else {
			cooldown.user = context.user.ID;
			cooldown.channel = null;
			cooldown.length = this.Cooldown * 2;
		}

		return {
			cooldown,
			reply: sb.Utils.tag.trim `
				Currently logging ${sb.Utils.groupDigits(chatLineAmount)} lines in total across all channels.
				${historyText}
			`
		};
	}),
	Dynamic_Description: null
};
