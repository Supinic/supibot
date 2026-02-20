import { getName } from "../../utils/languages.js";
import { declare } from "../../classes/command.js";

const BASE_CACHE_KEY = "liveuamap-data";
const SUPPORTED_LANGUAGE_CODES = ["en", "ru", "uk", "pl"];
const MAXIMUM_ARTICLES = 20;
const MAXIMUM_RPEATS = 10;

type EventItem = {
	title: string;
	delta: string;
	image: string | null;
	isPropaganda: boolean;
};
const repeats: string[] = [];

export default declare({
	Name: "liveuamap",
	Aliases: ["lum", "luam"],
	Cooldown: 10000,
	Description: "Fetches a recent event from the Russia-Ukraine War.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [{ name: "lang", type: "language" }],
	Whitelist_Response: null,
	Code: (async function liveUaMap (context) {
		const languageCode = (context.params.lang)
			? context.params.lang.getIsoCode(2)
			: "en";

		if (!languageCode) {
			return {
				success: false,
				reply: `Could not parse your provided language!`
			};
		}
		else if (!SUPPORTED_LANGUAGE_CODES.includes(languageCode)) {
			const supportedLanguageNames = SUPPORTED_LANGUAGE_CODES.map(i => getName(i));
			return {
				success: false,
				reply: `Your provided language is not supported! Use one of: ${supportedLanguageNames.join(", ")}`
			};
		}

		const cacheKey = `${BASE_CACHE_KEY}-${languageCode}`;
		let data = await this.getCacheData(cacheKey) as EventItem[] | null;
		if (!data) {
			const response = await core.Got.get("FakeAgent")({
				url: `https://liveuamap.com/${languageCode}`,
				responseType: "text",
				timeout: {
					request: 60_000
				}
			});

			if (!response.ok) {
				return {
					success: false,
					reply: `Website is currently unavailable (status code ${response.statusCode})! Try again later.`
				};
			}

			const $ = core.Utils.cheerio(response.body);
			const events = $("div.event");
			if (events.length === 0) {
				return {
					success: false,
					reply: `No events are currently available! Try again later.`
				};
			}

			const result = [];
			for (const node of events) {
				const $event = $(node);
				const title = $event.find("> .title").text().trim();
				if (title && title.toLowerCase().includes("siren")) {
					continue;
				}

				/* eslint-disable newline-per-chained-call */
				const delta = $event.find("> .time .date_add").first().text().trim();
				const image = $event.find("> .img img").first().attr("src") ?? null;
				const isPropaganda = ($event.find(".propaganda").length > 0);
				/* eslint-enable newline-per-chained-call */

				result.push({ title, delta, image, isPropaganda });

				if (result.length >= MAXIMUM_ARTICLES) {
					break;
				}
			}

			data = result;
			await this.setCacheData(BASE_CACHE_KEY, data, {
				expiry: 600_000 // 10 minutes
			});
		}

		const repeated = "";
		const filteredEvents = data.filter(i => !repeats.includes(i.title));
		const event = core.Utils.randArray(filteredEvents);
		const propagandaEmoji = (event.isPropaganda) ? "⚠" : "";

		repeats.unshift(event.title);
		repeats.splice(MAXIMUM_RPEATS);

		return {
			success: true,
			reply: `${propagandaEmoji} ${event.title} ${event.image ?? ""} (posted ${event.delta}${repeated})`
		};
	}),
	Dynamic_Description: null
});
