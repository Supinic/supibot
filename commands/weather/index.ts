import { SupiDate, SupiError } from "supi-core";

import { getWeatherLocation } from "./location.js";
import { declare } from "../../classes/command.js";
import { postToHastebin } from "../../utils/command-utils.js";

import {
	getSunPosition,
	isWeatherFormatKey,
	type OwmPollutionResponse,
	type OwmWeatherResponse,
	type WeatherFormatObject,
	WeatherItem
} from "./helpers.js";

const ALLOWED_FORMAT_TYPES = [
	"cloudCover",
	"humidity",
	"icon",
	"place",
	"precipitation",
	"pressure",
	"sun",
	"temperature",
	"windGusts",
	"windSpeed"
];
const POLLUTION_INDEX_ICONS = {
	1: "🔵",
	2: "🟢",
	3: "🟡",
	4: "🟠",
	5: "🔴"
};

export default declare({
	Name: "weather",
	Aliases: null,
	Cooldown: 10000,
	Description: "Fetches the current weather in a given location. You can specify parameters to check the forecast, or mention a user to get their location, if they set it up. Check all possibilities in extended help.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [
		{ name: "alerts", type: "boolean" },
		{ name: "format", type: "string" },
		{ name: "pollution", type: "boolean" },
		{ name: "status", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function weather (context, ...args) {
		if (!process.env.API_GOOGLE_GEOCODING) {
			throw new SupiError({
				message: "No Google geocoding key configured (API_GOOGLE_GEOCODING)"
			});
		}
		if (!process.env.API_OPEN_WEATHER_MAP) {
			throw new SupiError({
				message: "No OpenWeatherMap key configured (API_OPEN_WEATHER_MAP)"
			});
		}

		// @todo reformat this mess
		let weatherTime:
			| { number: null; type: "current"; }
			| { number: number; type: "hourly" | "daily"; }
				= { number: null, type: "current" };

		const weatherRegex = /\b(hour|day)\+(\d+)$/;
		const historyRegex = /-\s*\d/;

		if (args.length > 0) {
			const last = args.at(-1) as string; // Fully known because of array length check above
			if (historyRegex.test(last)) {
				return {
					success: false,
					reply: "Checking for weather history is not currently implemented"
				};
			}

			const weatherMatch = last.match(weatherRegex);
			if (weatherMatch) {
				args.pop();

				if (!weatherMatch[1] || !weatherMatch[2]) {
					return {
						success: false,
						reply: `Invalid syntax of hour/day parameters!`
					};
				}

				let type: "daily" | "hourly";
				const number = Number(weatherMatch[2]);
				if (weatherMatch[1] === "day") {
					type = "daily";
				}
				else if (weatherMatch[1] === "hour") {
					type = "hourly";
				}
				else {
					return {
						success: false,
						reply: "Invalid combination of parameters! Use day+# or hour+#"
					};
				}

				weatherTime = { type, number };
			}
		}

		const locationResult = await getWeatherLocation(context, args);
		if ("command" in locationResult) {
			return locationResult.command;
		}

		const { coords, address, hidden, origin } = locationResult.location;
		if (context.params.pollution) {
			const response = await core.Got.get("GenericAPI")<OwmPollutionResponse>({
				url: "https://api.openweathermap.org/data/2.5/air_pollution",
				responseType: "json",
				throwHttpErrors: false,
				timeout: {
					request: 60_000
				},
				searchParams: {
					lat: coords.lat,
					lon: coords.lng,
					appid: process.env.API_OPEN_WEATHER_MAP
				}
			});

			const [data] = response.body.list;
			const pollutionIndex = data.main.aqi;
			const { components } = data;
			const icon = POLLUTION_INDEX_ICONS[pollutionIndex];

			const componentsString = Object.entries(components)
				.map(([type, value]) => `${type.toUpperCase().replace("_", ".")}: ${value.toFixed(3)}`)
				.join(", ");

			return {
				reply: core.Utils.tag.trim `
					${address} current pollution index: ${pollutionIndex} ${icon}
					Particles: ${componentsString}.				
				`
			};
		}

		const weatherKey = { type: "weather", coords: `${coords.lat}-${coords.lng}` };
		let data = await this.getCacheData(weatherKey) as OwmWeatherResponse | undefined;
		if (!data) {
			const response = await core.Got.get("GenericAPI")<OwmWeatherResponse>({
				url: "https://api.openweathermap.org/data/3.0/onecall",
				responseType: "json",
				throwHttpErrors: false,
				timeout: {
					request: 60_000
				},
				searchParams: {
					lat: coords.lat,
					lon: coords.lng,
					units: "metric",
					appid: process.env.API_OPEN_WEATHER_MAP
				}
			});

			if (response.statusCode === 429) {
				return {
					success: false,
					reply: `The weather API is currently unavailable due to too many requests! Try again later.`
				};
			}
			else if (response.statusCode !== 200) {
				return {
					success: false,
					reply: `The weather API is currently not available! Try again later.`
				};
			}

			data = response.body;
			await this.setCacheData(weatherKey, data, {
				expiry: 10 * 60_000 // 10 minutes cache
			});
		}

		if (context.params.alerts) {
			if (!data.alerts || data.alerts.length === 0) {
				return {
					success: true,
					reply: `Weather alert summary for ${address} - no alerts.`
				};
			}

			const hastebinKey = { type: "hastebin", coords: `${coords.lat}-${coords.lng}` };
			let hastebinLink = await this.getCacheData(hastebinKey) as string | undefined;
			if (!hastebinLink) {
				const text = data.alerts.map(i => {
					const start = new SupiDate(i.start * 1000).setTimezoneOffset(data.timezone_offset / 60);
					const end = new SupiDate(i.end * 1000).setTimezoneOffset(data.timezone_offset / 60);
					const tags = (!i.tags || i.tags.length === 0)
						? ""
						: `-- ${i.tags.sort().join(", ")}`;

					return [
						`Weather alert from ${i.sender_name ?? ("(unknown source)")} ${tags}`,
						(i.event ?? "(no event specified)"),
						`Active between: ${start.format("Y-m-d H:i")} and ${end.format("Y-m-d H:i")} local time`,
						(i.description ?? "(no description)")
					].join("\n");
				}).join("\n\n");

				const paste = await postToHastebin(text, {
					title: (hidden)
						? `Weather alerts - private location`
						: `Weather alerts - ${address}`
				});

				if (!paste.ok) {
					return {
						success: false,
						reply: paste.reason
					};
				}

				hastebinLink = paste.link;
				await this.setCacheData(hastebinKey, hastebinLink, { expiry: 3_600_000 });
			}

			if (hidden) {
				if (origin === "self") {
					await context.platform.pm(
						`Your location's weather alerts: ${hastebinLink}`,
						context.user,
						context.channel
					);

					return {
						reply: core.Utils.tag.trim `
							Weather alert summary for your hidden location: ${data.alerts.length} alerts.
							I sent you a private message with the link to the full description.
						`
					};
				}
				else {
					return {
						reply: `Weather alert summary for their hidden location: ${data.alerts.length} alerts.`
					};
				}
			}
			else {
				return {
					reply: core.Utils.tag.trim `
						Weather alert summary for ${address} - 
						${data.alerts.length} alerts -
						full info: ${hastebinLink}
					`
				};
			}
		}

		let target: WeatherItem;
		if (weatherTime.type === "current") {
			target = new WeatherItem(data.current, data.minutely ?? []);
		}
		else if (weatherTime.type === "hourly") {
			const hourlyTarget = data.hourly.at(weatherTime.number);
			if (!hourlyTarget) {
				return {
					success: false,
					reply: `Invalid hour offset provided! Use a number between 0 and ${data.hourly.length - 1}.`
				};
			}

			target = new WeatherItem(hourlyTarget, data.minutely ?? []);
		}
		else {
			const dailyTarget = data.daily.at(weatherTime.number);
			if (!dailyTarget) {
				return {
					success: false,
					reply: `Invalid day offset provided! Use a number between 0 and ${data.daily.length - 1}.`
				};
			}

			target = new WeatherItem(dailyTarget, data.minutely ?? []);
		}

		const obj = {
			place: address,
			icon: target.icon,
			temperature: target.temperature,
			cloudCover: target.cloudCover,
			humidity: target.humidity,
			pressure: target.pressure,
			windSpeed: target.windSpeed,
			windGusts: target.windGusts,
			precipitation: target.precipitation,
			sun: (weatherTime.type === "current" && !hidden) ? getSunPosition(data) : ""
		} satisfies WeatherFormatObject;

		let weatherAlert = "";
		if (data.alerts && data.alerts.length !== 0) {
			const targetTime = new SupiDate();
			if (weatherTime.type === "hourly") {
				targetTime.addHours(weatherTime.number);
			}
			else if (weatherTime.type === "daily") {
				targetTime.addDays(weatherTime.number);
			}

			const relevantAlerts = data.alerts.filter(i => {
				const start = new SupiDate(i.start * 1000);
				const end = new SupiDate(i.end * 1000);

				return (start <= targetTime && end >= targetTime);
			});

			const tagList = relevantAlerts.flatMap(i => i.tags ?? []).sort();
			const tags = [...new Set(tagList)];

			if (tags.length > 0) {
				const plural = (tags.length > 1) ? "s" : "";
				weatherAlert = `⚠️ Weather alert${plural}: ${tags.join(", ")}.`;
			}
		}

		let plusTime;
		if (typeof weatherTime.number === "number") {
			const time = new SupiDate(target.dt * 1000).setTimezoneOffset(data.timezone_offset / 60);
			if (weatherTime.type === "hourly") {
				plusTime = ` (${time.format("H:00")} local time)`;
			}
			else {
				plusTime = ` (${time.format("j.n.")} local date)`;
			}
		}
		else {
			plusTime = " (now)";
		}

		if (!hidden) {
			const counter = this.registerMetric("Counter", "geomap_count", {
				help: "Total amount of command usages for specific GPS coordinates.",
				labelNames: ["lat", "lng"]
			});

			counter.inc({
				lat: coords.lat,
				lng: coords.lng
			});
		}

		if (context.params.format) {
			const format = new Set(context.params.format.split(/\W/).filter(Boolean));
			const reply = [];

			for (const element of format) {
				if (!isWeatherFormatKey(element, obj)) {
					return {
						success: false,
						reply: `Cannot create custom weather format with the "${element}" element!`
					};
				}

				reply.push(obj[element]);
			}

			return {
				reply: reply.join(" ")
			};
		}
		else {
			return {
				reply: core.Utils.tag.trim `
					${obj.place} ${plusTime}:
					${obj.icon}
					${obj.temperature}
					${obj.cloudCover}
					${obj.windSpeed} ${obj.windGusts}
					${obj.humidity}
					${obj.precipitation}
					${obj.pressure}
					${obj.sun}
					${weatherAlert}
				`
			};
		}
	}),
	Dynamic_Description: (prefix) => ([
		"Checks for current weather, or for hourly/daily forecast in a given location.",
		"If you, or a given user have set their location with the <code>set</code> command, this command supports that.",
		"",

		`<code>${prefix}weather (place)</code>`,
		"current weather in given location",
		"",

		`<code>${prefix}weather (place) <b>hour+X</b></code>`,
		"weather forecast in X hour(s) - accepts 0 (this hour) through 48 (in 2 days).",
		"",

		`<code>${prefix}weather (place) <b>day+X</b></code>`,
		"weather forecast in X day(s) - accepts 0 (today) through 7 (next week).",
		"",

		`<code>${prefix}weather (place) alerts:true</code>`,
		"Posts a summary of all weather alerts for the provided location - for the next 7 days.",
		"",

		`<code>${prefix}weather (place) pollution:true</code>`,
		"Posts a summary of the current pollution for the provided location.",
		"",

		`<code>${prefix}weather (place) status:text</code>`,
		"Instead of posting an emoji signifying the current weather state, a brief text description will be used instead.",
		"",

		`<code>${prefix}weather (place) format:(custom format)</code>`,
		`<code>${prefix}weather (place) format:temperature</code>`,
		`<code>${prefix}weather (place) format:temperature,humidity,pressure</code>`,
		"Lets you choose specific weather elements to show in the result.",
		`Supported elements: <code>${ALLOWED_FORMAT_TYPES.join(", ")}</code>`,
		"",

		`<code>${prefix}weather latitude:(number) longitude:(number)</code>`,
		`<code>${prefix}weather latitude:0.2998175 longitude:32.5394548</code>`,
		"Allows you to query a location to find weather in by GPS coordinates precisely.",
		"",

		"",
		"=".repeat(20),
		"",

		`<code>${prefix}weather</code>`,
		"If you set your own weather location, show its weather.",
		"",

		`<code>${prefix}weather alerts:true</code>`,
		"Posts a summary of all weather alerts for your location - for the next 7 days, if you have set it up.",
		"",

		`<code>${prefix}weather @User</code>`,
		"If that user has set their own weather location, show its weather. The <code>@</code> symbol is mandatory.",
		"",

		`<code>${prefix}weather @User <b>(hour+X/day+X)</b></code>`,
		"Similar to above, shows the user's weather, but uses the hour/day specifier.",
		"",

		`<code>${prefix}weather @User alerts:true</code>`,
		"Posts a summary of all weather alerts for the user's location - for the next 7 days.",
		"",

		`<code>${prefix}weather pollution:true</code>`,
		`<code>${prefix}weather @User pollution:true</code>`,
		"Posts a summary of the current pollution for your or the provided user's location."
	])
});
