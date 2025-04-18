export default {
	Name: "dayoftheyear",
	Aliases: ["doty", "monthoftheyear", "moty"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Checks what kind of international day (or month) it is today (or this month). Also accepts specific dates.",
	Flags: ["mention","non-nullable","pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function percent (context, ...args) {
		if (!process.env.API_DAYS_OF_THE_YEAR) {
			throw new sb.Error({
				message: "No DaysOfTheYear key configured (API_DAYS_OF_THE_YEAR)"
			});
		}

		const { invocation } = context;
		const type = (invocation === "doty" || invocation === "dayoftheyear")
			? "day"
			: "month";

		const date = (args.length > 0)
			? new sb.Date(args.join(" "))
			: new sb.Date();

		if (!date.valueOf()) {
			return {
				success: false,
				reply: `Invalid date provided!`
			};
		}

		const month = sb.Date.zf(date.month, 2);
		const day = sb.Date.zf(date.day, 2);
		const identifier = (type === "day")
			? `${date.year}/${month}/${day}`
			: `${date.year}/${month}`;

		let data = await this.getCacheData(identifier);
		if (!data) {
			const response = await core.Got.get("GenericAPI")({
				url: `https://www.daysoftheyear.com/api/v1/date/${identifier}`,
				headers: {
					"X-Api-Key": process.env.API_DAYS_OF_THE_YEAR
				}
			});

			data = response.body.data;
			await this.setCacheData(identifier, data, {
				expiry: 36e5 // 1 hour
			});
		}

		const repeatKey = (context.channel) ? `channel-${context.channel.ID}` : `platform-${context.platform.ID}`;
		this.data.repeats ??= {};
		this.data.repeats[repeatKey] ??= [];

		const typeName = (type === "day") ? "Today" : "This month";
		const eligibleItems = data.filter(i => i.type === type && !this.data.repeats[repeatKey].includes(i.name));
		if (eligibleItems.length === 0) {
			return {
				success: false,
				reply: `You have checked all the ${type}s for ${typeName.toLowerCase()}! ♻ If you try again, you will receive repeated results.`
			};
		}

		const item = core.Utils.randArray(eligibleItems);
		return {
			reply: `${typeName} is ${item.name}: ${core.Utils.fixHTML(item.excerpt)} ${item.url}`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Checks what kind of international day (or month) it is today (or this month).",
		"Also supports checking for other days and months.",
		`Powered by <a title="Days Of The Year" href="https://www.daysoftheyear.com">Days Of The Year</a>.`,
		"",

		`<code>${prefix}dayoftheyear</code>`,
		`<code>${prefix}doty</code>`,
		"Gives you info about today's international day(s).",
		"",

		`<code>${prefix}monthoftheyear</code>`,
		`<code>${prefix}moty</code>`,
		"Gives you info about this month's international month(s).",
		"",

		`<code>${prefix}doty <u>(date)</u></code>`,
		`<code>${prefix}moty <u>(date)</u></code>`,
		`<code>${prefix}doty <u>2022-10-25</u></code>`,
		`<code>${prefix}moty <u>2022-10</u></code>`,
		"You can also check specific dates or months."
	])
};
