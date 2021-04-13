module.exports = {
	Name: "countlinetotal",
	Aliases: ["clt"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Fetches the amount of data lines from ALL the log tables Supibot uses, including the total size and a prediction of when the storage will run out.",
	Flags: ["mention"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function countLineTotal (context) {
		const data = await sb.Query.getRecordset(rs => rs
			.select("(SUM(DATA_LENGTH) + SUM(INDEX_LENGTH)) AS Bytes")
			.select("SUM(AUTO_INCREMENT) AS Chat_Lines")
			.from("INFORMATION_SCHEMA", "TABLES")
			.where("TABLE_SCHEMA = %s", "chat_line")
			.single()
		);
	
		const history = await sb.Query.getRecordset(rs => rs
			.select("Executed", "Result")
			.from("chat_data", "Command_Execution")
			.where("Command = %n", this.ID)
			.where("Result <> %s", "")
			.orderBy("Executed ASC")
			.limit(1)
			.single()
		);

		let historyText = "";
		const currentSize = sb.Utils.round(data.Bytes / (10 ** 9), 3);
		
		if (history) {
			const days = (sb.Date.now() - history.Executed) / 864.0e5;
			const originalSize = Number(history.Result.match(/([\d.]+) GB of space/)[1]);
			const rate = sb.Utils.round((currentSize - originalSize) / days, 3);
			const megabytesPerHour = sb.Utils.round(rate * 1024 / 24, 3);
			const fillDate = new sb.Date().addDays((220 - currentSize) / rate); // 238 GB minus an estimate of ~18GB of other stuff

			historyText = `Lines are added at a rate of ~${megabytesPerHour} MB/hr. `
			historyText += (megabytesPerHour === 0)
				? `At this rate, its impossible to calculate when Supibot's hard drive will fill.`
				: `At this rate, Supibot's hard drive will run out of space approximately on ${fillDate.format("Y-m-d")}.`
		}

		const cooldown = {};
		if (context.channel) {
			cooldown.user = null;
			cooldown.channel = context.channel.ID;
			cooldown.length = this.Cooldown;
		}
		else {
			cooldown.user = context.user.ID;
			cooldown.channel - null;
			cooldown.length = this.Cooldown * 2;
		}

		return {
			cooldown,
			reply: sb.Utils.tag.trim `
				Currently logging ${sb.Utils.groupDigits(data.Chat_Lines)} lines in total across all channels,
				taking up ~${currentSize} GB of space.
				${historyText}
			`
		};
	}),
	Dynamic_Description: null
};
