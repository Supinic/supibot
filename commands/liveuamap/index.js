const LanguageCodes = require("../../utils/languages");
const BASE_CACHE_KEY = "liveuamap-data";
const SUPPORTED_LANGUAGE_CODES = ["en", "ru", "uk", "pl"];
const MAXIMUM_ARTICLES = 10;

module.exports = {
	Name: "liveuamap",
	Aliases: ["lum", "luam"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Gets a recent event from the Russia-Ukraine War.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "lang", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function liveUaMap (context) {
		const inputLanguage = context.params.lang ?? "en";
		const languageCode = LanguageCodes.getCode(inputLanguage); // @todo fix so that params.lang is of type `language`
		if (!languageCode) {
			return {
				success: false,
				reply: `Could not parse your provided language!`
			};
		}
		else if (!SUPPORTED_LANGUAGE_CODES.includes(languageCode)) {
			const supportedLanguageNames = SUPPORTED_LANGUAGE_CODES.map(i => LanguageCodes.getName(i));
			return {
				success: false,
				reply: `Your provided language is not supported! Use one of: ${supportedLanguageNames.join(", ")}`
			};
		}

		const cacheKey = `${BASE_CACHE_KEY}-${languageCode}`;
		let data = await this.getCacheData(cacheKey);
		if (!data) {
			let response;
			try {
				response = await sb.Got.get("FakeAgent")({
					url: `https://liveuamap.com/${languageCode}`,
					responseType: "text",
					timeout: {
						request: 60_000
					}
				});
			}
			catch (e) {
				return {
					success: false,
					reply: `No response received from website! Try again later.`
				};
			}

			if (response.statusCode !== 200) {
				return {
					success: false,
					reply: `Website is currently unavailable (status code ${response.statusCode})! Try again later.`
				};
			}

			const result = [];
			const $ = sb.Utils.cheerio(response.body);
			const events = $("div.event");
			if (events.length === 0) {
				return {
					success: false,
					reply: `No events are currently available! Try again later.`
				};
			}

			for (let i = 0; i < Array.from(events).length; i++) {
				const node = events[i];
				const title = [...node.children].find(i => i.attribs?.class === "title").children[0].data;
				const timeEl = [...node.children].find(i => i.attribs?.class?.includes("time"));
				const deltaEl = [...timeEl.children].find(i => i.attribs?.class === "date_add");
				const delta = deltaEl.children[0].data;
				const imgEl = [...node.children].find(i => i.attribs?.class?.includes("img"));
				const image = imgEl.children[0]?.children[0].attribs.src ?? null;
				const isPropaganda = [...node.children].some(i => i.attribs?.class?.includes("propaganda"));

				if (title && title.toLowerCase().includes("siren")) {
					continue;
				}

				result.push({
					title,
					delta,
					image,
					isPropaganda
				});

				if (result.length >= MAXIMUM_ARTICLES) {
					break;
				}
			}

			data = result;
			await this.setCacheData(BASE_CACHE_KEY, data, {
				expiry: 600_000 // 10 minutes
			});
		}

		this.data.repeats ??= [];

		let repeated = "";
		let filteredEvents = data.filter(i => !this.data.repeats.includes(i.title));
		if (filteredEvents.length === 0) {
			filteredEvents = data;

			repeated = " ♻";
			this.data.repeats = [];
		}

		const [event] = filteredEvents;
		const propagandaEmoji = (event.isPropaganda) ? "⚠" : "";
		this.data.repeats.push(event.title);

		return {
			reply: `${propagandaEmoji} ${event.title} ${event.image ?? ""} (posted ${event.delta}${repeated})`
		};
	}),
	Dynamic_Description: null
};
