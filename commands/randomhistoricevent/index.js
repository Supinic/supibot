import { SupiDate } from "supi-core";

const formatter = new Intl.DateTimeFormat("en-GB", {
	month: "long"
});

export default {
	Name: "randomhistoricevent",
	Aliases: ["rhe"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "For a given day, posts a random historic event that happened on that day. If not provided, uses today's date.",
	Flags: ["mention","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function randomHistoricEvent (context, ...args) {
		const date = (args.length > 0)
			? new SupiDate(args.join(" "))
			: new SupiDate();

		if (!date.valueOf()) {
			return {
				success: false,
				reply: `Invalid date provided!`
			};
		}

		const { day, month } = date;
		const event = await core.Query.getRecordset(rs => rs
			.select("Year", "Text")
			.from("data", "Historic_Event")
			.where("Day = %n", day)
			.where("Month = %n", month)
			.orderBy("RAND()")
			.limit(1)
			.single()
		);

		const fullMonth = formatter.format(date);
		return {
			reply: `${fullMonth} ${day}, ${event.Year}: ${event.Text}`
		};
	}),
	Dynamic_Description: null
};
