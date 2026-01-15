import * as z from "zod";
import { SupiDate, SupiError } from "supi-core";
import { declare } from "../../classes/command.js";

const responseSchema = z.object({
	data: z.array(z.object({
		name: z.string(),
		type: z.string(), // "day", "other"
		excerpt: z.string(),
		url: z.string()
	}))
});

export default declare({
	Name: "dayoftheyear",
	Aliases: ["doty", "monthoftheyear", "moty"],
	Cooldown: 5000,
	Description: "Checks what kind of international day (or month) it is today (or this month). Also accepts specific dates.",
	Flags: ["mention", "non-nullable", "pipe", "skip-banphrase"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function percent (context, ...args) {
		if (!process.env.API_DAYS_OF_THE_YEAR) {
			throw new SupiError({
				message: "No DaysOfTheYear API key configured (API_DAYS_OF_THE_YEAR)"
			});
		}

		const { invocation } = context;
		const type = (invocation === "doty" || invocation === "dayoftheyear")
			? "day"
			: "month";

		const date = (args.length > 0)
			? new SupiDate(args.join(" "))
			: new SupiDate();

		if (!date.valueOf()) {
			return {
				success: false,
				reply: `Invalid date provided!`
			};
		}

		const month = SupiDate.zf(date.month, 2);
		const day = SupiDate.zf(date.day, 2);
		const identifier = (type === "day")
			? `${date.year}/${month}/${day}`
			: `${date.year}/${month}`;

		let data = await core.Cache.getByPrefix(identifier) as z.infer<typeof responseSchema>["data"] | undefined;
		if (!data) {
			const response = await core.Got.get("GenericAPI")({
				url: `https://www.daysoftheyear.com/api/v1/date/${identifier}`,
				headers: {
					"X-Api-Key": process.env.API_DAYS_OF_THE_YEAR
				}
			});

			data = responseSchema.parse(response.body).data;
			await this.setCacheData(identifier, data, {
				expiry: 36e5 // 1 hour
			});
		}

		const item = core.Utils.randArray(data);
		const typeName = (type === "day") ? "Today" : "This month";
		return {
			reply: `${typeName} is ${item.name}: ${core.Utils.fixHTML(item.excerpt)} ${item.url}`
		};
	}),
	Dynamic_Description: (prefix) => [
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
	]
});
