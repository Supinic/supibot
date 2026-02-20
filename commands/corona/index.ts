const url = "https://www.worldometers.info/coronavirus";
const cacheKey = "global-corona-stats";

type CoronaData = {
	success: true;
	total: number;
	deaths: number;
	recoveries: number;
};

const group = (num: number): string => core.Utils.groupDigits(num, " ");

const fetchData = async (): Promise<{ success: false } | CoronaData> => {
	let response;
	try {
		response = await core.Got.get("FakeAgent")({
			url,
			responseType: "text"
		});
	}
	catch {
		return {
			success: false
		};
	}

	const $ = core.Utils.cheerio(response.body);
	const nodes = $(".maincounter-number span");
	const array = [];
	for (const node of nodes) {
		const text = $(node)
			.text()
			.trim()
			.replaceAll(",", "");

		array.push(Number(text));
	}

	const [total, deaths, recoveries] = array;
	return {
		success: true,
		total,
		deaths,
		recoveries
	};
};

export default {
	Name: "corona",
	Aliases: ["covid"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Checks the current number of infected/deceased people from the Coronavirus spread that started in October-December 2019.",
	Flags: ["mention","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function corona () {
		let data = await core.Cache.getByPrefix("cacheKey") as CoronaData | undefined;
		if (!data) {
			const rawData = await fetchData();
			if (!rawData.success) {
				return {
					success: false,
					reply: `Could not fetch COVID related data! Try again later.`
				};
			}

			data = rawData;
			await core.Cache.setByPrefix(cacheKey, data, {
				expiry: 600_000 // 10 minutes
			});
		}

		return {
			reply: core.Utils.tag.trim `
				Global statistics:
				${group(data.total)} total cases,
				${group(data.deaths)} total deaths,
				${group(data.recoveries)} total recoveries.
			 `
		};
	}),
	Dynamic_Description: () => [
		`Checks the latest global data on the Corona COVID-19 virus's spread.`,
		"",

		`<code>$corona</code>`,
		"Posts the current global stats."
	]
};
