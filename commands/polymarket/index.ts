import * as z from "zod";
import { declare } from "../../classes/command.js";
import { SupiError } from "supi-core";
import { postToHastebin } from "../../utils/command-utils.js";

const marketShape = z.object({
	id: z.string(),
	question: z.string(),
	description: z.string(),
	slug: z.string(),
	startDate: z.string(),
	endDate: z.string(),
	outcomes: z.string(), // JSON stringified string[]
	outcomePrices: z.string().optional(), // JSON stringified string[]
	volumeNum: z.number().optional(),
	active: z.boolean(),
	closed: z.boolean()
}).transform(i => ({
	...i,
	volumeNum: (typeof i.volumeNum === "number")
		? core.Utils.round(i.volumeNum, 2)
		: 0,
	outcomes: JSON.parse(i.outcomes) as string[],
	outcomePrices: (i.outcomePrices) ? JSON.parse(i.outcomePrices) as string[] : null
}));

const eventShape = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string(),
	slug: z.string(),
	startDate: z.string(),
	endDate: z.string(),
	volume: z.number(),
	active: z.boolean(),
	closed: z.boolean(),
	markets: z.array(marketShape)
});
const searchSchema = z.object({
	events: z.array(eventShape).optional()
});

const formatOutcomes = (outcomes: string[], outcomePrices: string[]): string => {
	const prices = [];
	for (let i = 0; i < outcomes.length; i++) {
		const price = core.Utils.round(Number(outcomePrices[i]) * 100, 3);
		const string = `${outcomes[i]}: ${price}`;

		prices.push(string);
	}

	return prices.join(", ");
};

export default declare({
	Name: "polymarket",
	Aliases: ["poly"],
	Cooldown: 10000,
	Description: "",
	Flags: ["mention", "pipe"],
	Params: [{ name: "mode", type: "string" }],
	Whitelist_Response: null,
	Code: (async function polymarket (context, ...args) {
		const query = args.join(" ").trim();
		if (!query) {
			return {
				success: false,
				reply: "No search input provided! Provide something to search for first."
			};
		}

		const mode = context.params.mode ?? "direct";
		if (mode !== "direct" && mode !== "summary") {
			return {
				success: false,
				reply: `Invalid mode provided! Use "direct" or "summary" instead.`
			};
		}

		const response = await core.Got.get("GenericAPI")({
			url: "https://gamma-api.polymarket.com/public-search",
			searchParams: {
				q: query
			}
		});

		const { events } = searchSchema.parse(response.body);
		if (!events || events.length === 0) {
			return {
				success: false,
				reply: "No events found for your query!"
			};
		}

		if (mode === "direct") {
			const event = events.find(i => i.active && !i.closed);
			if (!event) {
				return {
					success: false,
					reply: "There are no active events found for your query!"
				};
			}

			const { markets } = event;
			const activeMarkets = markets.filter(i => i.active && !i.closed && i.outcomePrices);
			if (activeMarkets.length === 0) {
				return {
					success: false,
					reply: "There are no active markets found for your query's event!"
				};
			}

			const questions = activeMarkets.map(i => i.question);
			const bestTarget = core.Utils.selectClosestString(query, questions, {
				ignoreCase: true,
				descriptor: true
			});

			const market = (bestTarget)
				? activeMarkets.find(i => i.question === bestTarget.original)
				: activeMarkets[0];

			if (!market) {
				throw new SupiError({
					message: "Assert error: Market not found",
					args: { bestTarget, questions, query }
				});
			}

			const { volumeNum, outcomes, outcomePrices } = market;
			if (!outcomePrices) { // guaranteed by filtering above
				throw new SupiError({
					message: "Assert error: outcomePrices is empty",
					args: { market }
				});
			}

			const prices = formatOutcomes(outcomes, outcomePrices);

			return {
				success: true,
				reply: `Event "${event.title}" - market "${market.question}": ${prices}. Total volume: ${volumeNum}`
			};
		}
		else {
			const eventStrings = [];
			for (const event of events) {
				const { title, description, active, closed, markets, volume } = event;
				if (!active || closed) {
					continue;
				}

				const marketStrings = [];
				for (const market of markets) {
					const { question, active, closed, outcomes, outcomePrices } = market;
					if (!outcomePrices || !active) {
						continue;
					}

					const closedEmoji = (closed) ? "⛔ " : "";
					const prices = formatOutcomes(outcomes, outcomePrices);

					marketStrings.push(`${closedEmoji}${question} - ${prices}`.trim());
				}

				const cleanDescription = description.replaceAll(/\s+/g, " ");
				const marketString = marketStrings.join("\n");
				const volumeString = `Total volume for this event: ${volume}`;

				const eventString = `**${title}**\n${cleanDescription}\n\n${marketString}\n${volumeString}`.trim();
				eventStrings.push(eventString);
			}

			const result = await postToHastebin(eventStrings.join(`\n\n\n`));
			if (!result.ok) {
				return {
					success: false,
					reply: "Couldn't post the summary to Hastebin! Try again later."
				};
			}

			return {
				success: true,
				reply: `Summary for your query: ${result.link}`
			};
		}
	}),
	Dynamic_Description: null
});
