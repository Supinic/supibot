module.exports = {
	Name: "liveuamap",
	Aliases: ["lum", "luam"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Gets a recent event from the 2022 Russia/Ukraine war",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		cacheKey: "liveuamap-data",
		threshold: 10
	})),
	Code: (async function liveUaMap () {
		const { cacheKey } = this.staticData;
		let data = await this.getCacheData(cacheKey);
		if (!data) {
			let response;
			try {
				response = await sb.Got("FakeAgent", {
					url: "https://liveuamap.com/",
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

				result.push({
					title,
					delta,
					image
				});
			}

			data = result;
			await this.setCacheData(cacheKey, data, {
				expiry: 300_000 // 5 minutes
			});
		}

		this.data.repeats ??= [];

		let repeated = "";
		let filteredEvents = data.filter(i => !this.data.repeats.includes(i.title));
		if (!filteredEvents) {
			filteredEvents = data;

			repeated = "♻";
			this.data.repeats = [];
		}

		const [event] = filteredEvents;
		return {
			reply: `${repeated} ${event.title} ${event.image ?? ""} (posted ${event.delta})`
		};
	}),
	Dynamic_Description: null
};
