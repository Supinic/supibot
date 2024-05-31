const fetchData = require("./worldinfo.js");
const group = (num) => sb.Utils.groupDigits(num, " ");

module.exports = {
	Name: "corona",
	Aliases: ["covid"],
	Author: "supinic",
	Cooldown: 7500,
	Description: "Checks the current number of infected/deceased people from the Coronavirus spread that started in October-December 2019.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function corona () {
		let data = await this.getCacheData("global-corona");
		if (!data) {
			data = await fetchData();

			if (!data.success) {
				return {
					success: false,
					reply: `Could not fetch COVID related data! Try again later.`
				};
			}

			await this.setCacheData("global-corona", data, {
				expiry: 600_000 // 10 minutes
			});
		}

		return {
			reply: sb.Utils.tag.trim `
				Global statistics:
				${group(data.total)} total cases,
				${group(data.deaths)} total deaths,
				${group(data.recoveries)} total recoveries.
			 `
		};
	}),
	Dynamic_Description: (async function () {
		return [
			`Checks the latest global data on the Corona COVID-19 virus's spread.`,
			"",

			`<code>$corona</code>`,
			"Posts the current global stats.",
			""
		];
	})
};
