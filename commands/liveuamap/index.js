module.exports = {
	Name: "liveuamap",
	Aliases: ["lum", "luam"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Gets a recent event from the 2022 Russia/Ukraine war",
	Flags: ["mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "lang", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		baseCacheKey: "liveuamap-data",
		threshold: 10,
		supportedLanguageCodes: ["en", "ru", "uk", "pl"]
	})),
	Code: (async function liveUaMap (context) {
		const { baseCacheKey, supportedLanguageCodes } = this.staticData;

		const inputLanguage = context.params.lang ?? "en";
		const languageCode = sb.Utils.modules.languagesISO.getCode(inputLanguage);
		if (!languageCode) {
			return {
				success: false,
				reply: `Could not parse your provided language!`
			};
		}
		else if (!supportedLanguageCodes.includes(languageCode)) {
			const supportedLanguageNames = supportedLanguageCodes.map(i => sb.Utils.modules.languagesISO.getName(i));
			return {
				success: false,
				reply: `Your provided language is not supported! Use one of: ${supportedLanguageNames.join(", ")}`
			};
		}

		const cacheKey = `${baseCacheKey}-${languageCode}`;
		let data = await this.getCacheData(cacheKey);
		if (!data) {
			let response;
			try {
				response = await sb.Got("FakeAgent", {
					url: `https://liveuamap.com/${languageCode}`,
					responseType: "text",
					timeout: 60_000
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

			const { threshold } = this.staticData;
			const result = [];
			const $ = sb.Utils.cheerio(response.body);
			const events = $("div.event");
			if (events.length === 0) {
				return {
					success: false,
					reply: `No events are currently available! Try again later.`
				};
			}

			for (const node of events.slice(0, threshold)) {
				const title = [...node.children].find(i => i.attribs?.class === "title").children[0].data;
				const timeEl = [...node.children].find(i => i.attribs?.class?.includes("time"));
				const deltaEl = [...timeEl.children].find(i => i.attribs?.class === "date_add");
				const delta = deltaEl.children[0].data;
				const imgEl = [...node.children].find(i => i.attribs?.class?.includes("img"));
				const image = imgEl.children[0]?.children[0].attribs.src ?? null;
				const isPropaganda = [...node.children].some(i => i.attribs?.class?.includes("propaganda"));

				result.push({
					title,
					delta,
					image,
					isPropaganda
				});
			}

			data = result;
			await this.setCacheData(cacheKey, data, {
				expiry: 600_000 // 5 minutes
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
