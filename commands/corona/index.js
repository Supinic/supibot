module.exports = {
	Name: "corona",
	Aliases: ["covid"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 7500,
	Description: "Checks the current amount of infected/deceased people from the Corona Virus spread started in October-December 2019.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: (() => {
		const special = {
			"AU": "Australia",
			"CAR": "Central African Republic",
			"DRC": "Democratic Republic of the Congo",
			"UAE": "United Arab Emirates",
			"UK": "United Kingdom",
			"USA": "United States of America"
		};
		const regions = [
			"Africa",
			"Antarctica",
			"Asia",
			"Central America",
			"Europe",
			"North America",
			"Oceania",
			"South America"
		].map(i => i.toLowerCase());
	
		return {
			special,
			regions,
			fetch: {
				topData: (limit) => sb.Query.getRecordset(rs => rs
					.select("Place.Name AS Country", "All_Cases")
					.from("corona", "Status")
					.join({
						toTable: "Place",
						on: "Place.ID = Status.Place"
					})
					.where("Latest = %b", true)
					.where("Place.Parent IS NULL")
					.groupBy("Place")
					.orderBy("Date DESC")
					.orderBy("All_Cases DESC")
					.limit(limit)
				),
				regionalData: (region) => sb.Query.getRecordset(rs => rs
					.select("Place.Name")
					.select("Place.Parent")
					.select("Place.Region")
					.select("All_Cases")
					.select("All_Deaths")
					.select("All_Recoveries")
					.select("New_Cases")
					.select("New_Deaths")
					.from("corona", "Status")
					.join({
						toTable: "Place",
						on: "Place.ID = Status.Place"
					})
					.where("Latest = %b", true)
					.where({ condition: region === null }, "Place.Parent IS NULL")
					.where({ condition: typeof region === "string" }, "Place.Parent IS NULL AND Place.Region = %s", region)
					.groupBy("Status.Place")
					.orderBy("Status.Date DESC")
				),
				countryData: (region, country, direct = false) => sb.Query.getRecordset(rs => rs
					.select("Place.Name")
					.select("Place.Parent")
					.select("All_Cases")
					.select("All_Deaths")
					.select("All_Recoveries")
					.select("New_Cases")
					.select("New_Deaths")
					.select("Population")
					.select("Tests")
					.from("corona", "Status")
					.join({
						toTable: "Place",
						on: "Place.ID = Status.Place"
					})
					.where("Latest = %b", true)
					.where({ condition: direct === false }, "Place.Name %*like*", country)
					.where({ condition: direct === true }, "Place.Name = %s", country)
					.where({ condition: region !== null }, "Place.Parent = %s", region)
					.orderBy("Status.Date DESC")
					.limit(1)
				)
			},
			sumObjectArray: (array) => {
				const result = {};
				for (const row of array) {
					for (const key of Object.keys(row)) {
						if (typeof row[key] === "number") {
							result[key] = (result[key] ?? 0) + row[key];
						}
					}
				}
	
				return result;
			},
			getEmoji: async (country) => {
				if (country === null) {
					return sb.Utils.randArray(["🌏", "🌎", "🌍"]);
				}
	
				const fixedCountryName = special[country.toUpperCase()] ?? country;
				const countryData = await sb.Query.getRecordset(rs => rs
					.select("Code_Alpha_2 AS Code")
					.from("data", "Country")
					.where("Name = %s", fixedCountryName)
					.limit(1)
					.single()
				);
	
				if (countryData?.Code) {
					return String.fromCodePoint(...countryData.Code.split("").map(i => i.charCodeAt(0) + 127397));
				}
				else {
					return null;
				}
			}
		};
	}),
	Code: (async function corona (context, ...args) {
		const input = args.join(" ").toLowerCase();
		let region = null;
		let country = null;
		let targetData = null;
	
		if (input.startsWith("@")) {
			const userData = await sb.User.get(input);
			if (!userData) {
				return {
					success: false,
					reply: "That user does not exist!"
				};
			}
			else if (!userData.Data.location) {
				return {
					success: false,
					reply: "That user does not have their location set!"
				};
			}
			else if (userData.Data.location.hidden) {
				return {
					success: false,
					reply: "That user has hidden their precise location!"
				};
			}
			else if (!userData.Data.location.components.country) {
				return {
					success: false,
					reply: "That user does not have their country location set!"
				};
			}
	
			country = userData.Data.location.components.country;
		}
		else if (input === "stats" || input === "dump") {
			return {
				reply: "Check the current stats here: https://supinic.com/data/corona/global/latest"
			};
		}
		else if (input === "top") {
			const result = (await this.staticData.fetch.topData(10))
				.map((i, ind) => `#${ind + 1}: ${i.Country} (${Math.trunc(i.All_Cases / 1e3)}k)`)
				.join("; ");
	
			return {
				reply: "Top 10 countries by cases: " + result
			};
		}
		else if (input.includes(":")) {
			[region, country] = input.split(":").map(i => i.trim());
		}
		else if (input.length > 0) {
			country = input;
		}
	
		if (this.staticData.regions.includes(input)) {
			region = input;
			targetData = await this.staticData.fetch.regionalData(region);
		}
		else if (country) {
			const [loose, strict] = await Promise.all([
				this.staticData.fetch.countryData(region, country, false),
				this.staticData.fetch.countryData(region, country, true)
			]);
	
			const result = sb.Utils.selectClosestString(
				country,
				[loose[0]?.Name, strict[0]?.Name].filter(Boolean),
				{ ignoreCase: true }
			);
	
			if (result) {
				targetData = [loose, strict].find(i => i[0]?.Name && i[0].Name.toLowerCase() === result.toLowerCase());
			}
			else {
				targetData = loose;
			}
		}
		else {
			targetData = await this.staticData.fetch.regionalData(null);
		}
	
		if (!targetData || targetData.length === 0) {
			return {
				reply: "That country has no Corona virus data available!"
			};
		}
	
		const { Region: prettyRegion } = targetData[0];
		if (targetData.length === 1) {
			targetData = targetData[0];
		}
		else if (targetData.length > 1) {
			targetData = this.staticData.sumObjectArray(targetData);
		}
	
		let intro = null;
		if (region && !country) {
			intro = prettyRegion;
		}
		else if (!targetData.Parent) {
			intro = await this.staticData.getEmoji(targetData.Name ?? null);
			if (!intro) {
				intro = targetData.Name;
			}
		}
		else {
			const emoji = await this.staticData.getEmoji(targetData.Parent);
			intro = `${targetData.Name} (${emoji})`;
		}
	
		const {
			All_Cases: allCases,
			All_Deaths: allDeaths,
			All_Recoveries: allRecoveries,
			New_Cases: newCases,
			New_Deaths: newDeaths,
			Population: population,
			Tests: tests
		} = targetData;
	
		const group = sb.Utils.groupDigits;
		const cases = {
			amount: group(allCases),
			word: (allCases === 1) ? "case" : "cases",
			plusPrefix: (newCases > 0) ? "+" : (newCases < 0) ? "-" : "±",
			plusWord: (newCases === 1) ? "case" : "cases",
			plusAmount: (newCases) ? group(newCases) : null
		};
		const deaths = {
			amount: (allDeaths) ? group(allDeaths) : "unknown amount of",
			word: (allDeaths === 1) ? "death" : "deaths",
			plusPrefix: (newDeaths > 0) ? "+" : (newDeaths < 0) ? "-" : "±",
			plusWord: (newDeaths === 1) ? "death" : "deaths",
			plusAmount: (newDeaths) ? group(newDeaths) : null
		};
		const recoveries = {
			amount: (allRecoveries) ? group(allRecoveries) : "unknown amount of",
			word: (allRecoveries === 1) ? "recovery" : "recoveries"
		};
	
		const ratios = {};
		if (population !== null) {
			ratios.cpm = sb.Utils.round((allCases / population) * 1e6, 2);
			ratios.dpm = sb.Utils.round((allDeaths / population) * 1e6, 2);
			if (tests !== null) {
				ratios.tpm = sb.Utils.round((tests / population) * 1e6, 2);
			}
		}
	
		const active = group(allCases - (allDeaths ?? 0) - (allRecoveries ?? 0));		
		return {
			reply: sb.Utils.tag.trim `
				${intro}
				has 
				${active} active cases,
				${cases.amount} total ${cases.word}${(cases.plusAmount === null)
					? ""
					: ` (${cases.plusPrefix}${cases.plusAmount})`
				},
	
				${deaths.amount} ${deaths.word}${(deaths.plusAmount === null)
					? ""
					: ` (${deaths.plusPrefix}${deaths.plusAmount})`
				}
	
				and ${recoveries.amount} ${recoveries.word}.		
	
				${(tests)
					? `${group(tests)} tests have been performed so far.`
					: ""
				}
	
				${(ratios.cpm)
				? (ratios.tpm)
					? `This is ${group(ratios.cpm)} cases, ${group(ratios.dpm)} deaths, and ${group(ratios.tpm)} tests per million.`
					: `This is ${group(ratios.cpm)} cases, and ${group(ratios.dpm)} deaths per million.`
				: ""
			}`
		};
	}),
	Dynamic_Description: async (prefix) => {
		const row = await sb.Query.getRow("chat_data", "Command");
		await row.load(200);
	
		const data = eval(row.values.Static_Data);
		const regions = data.regions.map(i => `<li><code>${i}</code></li>`).join("");
	
		const subregions = (await sb.Query.getRecordset(rs => rs
			.select("DISTINCT Parent")
			.from("corona", "Place")
	       		.where("Parent IS NOT NULL")
		)).map(i => `<li><code>${i.Parent}</code></li>`).sort().join("");		
	
		return [
			`Checks the latest data on the Corona COVID-19 virus's spread, either globally or in a region/country.`,
			`The code for scraper can be found on GitHub: <a target="_blank" href="https://github.com/Supinic/supi-corona">supi-corona</a>.`,
	
			`<code>${prefix}corona</code>`,
			"Posts the current global stats.",
			"",
	
			`<code>${prefix}corona (global region)</code>`,
			`Posts a given global region's cumulative stats.`,
			`Supported global regions: <ul>${regions}</ul>`,
	
			`<code>${prefix}corona (country/region)</code>`,
			`Posts a given country's <b>OR</b> region's data. Countries take precedence. I.e. "Georgia" will post the country, not the USA state.`,
			"",
	
			`<code>${prefix}corona (region):(country)</code>`,
			`E.g.: <code>${prefix}corona USA:Georgia</code>`,
			`Posts a given country region's data. Use when you need to specify an ambiguous region.`,
			`Keep in mind the region names are local. E.g. <code>Lombardia</code> and not <code>Lombardy</code>`,
			`Supported countries with regions: <ul>${subregions}</ul>`,
	
			`<code>${prefix}corona @User</code>`,
			"If a given user has set their default location (and it is public), this will check their country's corona stats."
		];
	}
};