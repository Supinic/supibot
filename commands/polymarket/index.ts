import * as z from "zod";
import { declare } from "../../classes/command.js";
import { SupiError } from "supi-core";
import * as eventS from "node:events";
import { postToHastebin } from "../../utils/command-utils.js";

const marketShape = z.object({
	id: z.string(),
	question: z.string(),
	description: z.string(),
	slug: z.string(),
	startDate: z.string(),
	endDate: z.string(),
	outcomes: z.string(), // JSON stringified string[]
	outcomePrices: z.string(), // JSON stringified string[]
	volume: z.number(),
	active: z.boolean(),
	closed: z.boolean()
});
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

const formatOutcomes = (market: z.infer<typeof marketShape>): string => {
	const outcomes = JSON.parse(market.outcomes) as string[];
	const outcomePrices = (JSON.parse(market.outcomePrices) as string[]).map(Number);

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
			const event = events.find(i => i.active);
			if (!event) {
				return {
					success: false,
					reply: "There are no active events found for your query!"
				};
			}

			const { markets } = event;
			const activeMarkets = markets.filter(i => i.active);
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

			const { volume } = market;
			const prices = formatOutcomes(market);

			return {
				success: true,
				reply: `Event "${event.title}" - market "${market.question}": ${prices}. Total volume: ${volume}`
			};
		}
		else {
			const eventStrings = [];
			for (const event of events) {
				const { title, description, active, markets } = event;
				const inactiveEmoji = (active) ? "" : "⛔";

				const marketStrings = [];
				for (const market of markets) {
					const { question, active } = market;
					const inactiveEmoji = (active) ? "" : "⛔ ";
					const prices = formatOutcomes(market);

					marketStrings.push(`\t${inactiveEmoji}${question} - ${prices}`);
				}

				const marketString = marketStrings.join("\n");
				const eventString = `${inactiveEmoji}${title}\n${description}\n\n${marketString}`;
				eventStrings.push(eventString);
			}

			const result = await postToHastebin(eventStrings.join(`\n====\n`));
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
