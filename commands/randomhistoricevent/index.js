module.exports = {
	Name: "randomhistoricevent",
	Aliases: ["rhe"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 10000,
	Description: null,
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: ({
		formatter: new Intl.DateTimeFormat("en-GB", {
			month: "long",
			day: "numeric"
		})
	}),
	Code: (async function randomHistoricEvent (context, ...args) {
		const date = (args.length > 0)
			? new sb.Date(args.join(" "))
			: new sb.Date();
	
		if (!date.valueOf()) {
			return {
				success: false,
				reply: `Invalid date provided!`
			};
		}
	
		const { day, month } = date;
		let event = await sb.Query.getRecordset(rs => rs
			.select("Year", "Text")
			.from("data", "Historic_Event")
			.where("Day = %n", day)
			.where("Month = %n", month)
			.orderBy("RAND()")
			.limit(1)
			.single()
		);
	
		return {
			reply: `Year ${event.Year}: ${event.Text}`
		};
	}),
	Dynamic_Description: null
};