module.exports = {
	Name: "liveuamap",
	Aliases: ["lum"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Gets a recent event from the 2022 Russia/Ukraine war",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		threshold: 5
	})),
	Code: (async function liveUaMap () {
		let data = await this.getCacheData("liveuamap-data");
		if (!data) {
			let response;
			try {
				response = await sb.Got("FakeAgent", {
					url: "https://liveuamap.com/",
					responseType: "html",
					timeout: 60_000
				});
			}
			catch {
				return {
					success: false,
					reply: `No response received from website! Try again later.`
				};
			}

			const { threshold } = this.staticData;
			const result = [];
			const $ = sb.Utils.cheerio(response.body);
			const events = $("div.event");

			for (const node of events.slice(0, threshold)) {
				const title = [...node.children].find(i => i.attribs?.class === "title").children[0].data;
				const timeEl = [...node.children].find(i => i.attribs?.class?.includes("time"));
				const deltaEl = [...timeEl.children].find(i => i.attribs?.class === "date_add");
				const delta = deltaEl.children[0].data;
				const imgEl = [...node.children].find(i => i.attribs?.class?.includes("img"));
				const img = imgEl.children[0]?.children[0].attribs.src ?? null;

				result.push({
					title,
					delta,
					img
				});
			}

			data = result;
			await this.setCacheData("liveuamap-data", data, {
				expiry: 300_000 // 5 minutes
			});
		}

		this.data.repeats ??= [];

		let filteredEvents = data.filter(i => !this.data.repeats.includes(i.title));
		if (!filteredEvents) {
			filteredEvents = data;
			this.data.repeats = [];
		}

		const event = sb.Utils.randArray(filteredEvents);
		return {
			reply: `${event.title} ${event.img ?? ""} (posted ${event.delta})`
		};
	}),
	Dynamic_Description: null
};
