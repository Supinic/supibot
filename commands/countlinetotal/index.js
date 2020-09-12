module.exports = {
	Name: "countlinetotal",
	Aliases: ["clt"],
	Author: "supinic",
	Last_Edit: "2020-09-12T18:19:43.000Z",
	Cooldown: 0,
	Description: "Fetches the amount of data lines from ALL the log tables, including the total size.",
	Flags: ["mention","pipe","skip-banphrase","system","whitelist"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function countLineTotal () {
		let preciseLines = 0;
		for (const channel of sb.Channel.data.filter(i => i.Type !== "Inactive")) {
			const rs = await sb.Query.getRecordset(rs => rs
				.select("MAX(ID) AS Total")
				.from("chat_line", channel.getDatabaseName())
				.single()
			);
	
			if (!rs) {
				console.warn("countlinetotal: No ID found", channel.Name);
				continue;
			}
	
			preciseLines += rs.Total;
		}
	
		const data = await sb.Query.getRecordset(rs => rs
			.select("(SUM(DATA_LENGTH) + SUM(INDEX_LENGTH)) AS Bytes")
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
	
		const days = (sb.Date.now() - history.Executed) / 864.0e5;
		const originalSize = Number(history.Result.match(/([\d.]+) GB of space/)[1]);
		const currentSize = sb.Utils.round(data.Bytes / (10 ** 9), 3);
	
		const rate = sb.Utils.round((currentSize - originalSize) / days, 3);
		const fillDate = new sb.Date().addDays((220 - currentSize) / rate); // 238 GB minus an estimate of ~18GB of other stuff
		const megabytesPerHour = sb.Utils.round(rate * 1024 / 24, 3);
	
		return {
			reply: sb.Utils.tag.trim `
				Currently logging ${sb.Utils.groupDigits(preciseLines)} lines in total across all channels,
				taking up ~${currentSize} GB of space.
				Lines are added at a rate of ~${megabytesPerHour} MB/hr.
				At this rate, Supibot's hard drive will run out of space approximately on ${fillDate.format("Y-m-d")}.
			`
		};
	}),
	Dynamic_Description: null
};