module.exports = {
	Name: "randomhistoricevent",
	Aliases: ["rhe"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "For a given day, posts a random historic event that happened on that day. If not provided, uses the today's date.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		formatter: new Intl.DateTimeFormat("en-GB", {
			month: "long"
		})
	})),
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
		const event = await sb.Query.getRecordset(rs => rs
			.select("Year", "Text")
			.from("data", "Historic_Event")
			.where("Day = %n", day)
			.where("Month = %n", month)
			.orderBy("RAND()")
			.limit(1)
			.single()
		);
	
		const fullMonth = this.staticData.formatter.format(date);
		return {
			reply: `${fullMonth} ${day}, ${event.Year}: ${event.Text}`
		};
	}),
	Dynamic_Description: null
};
