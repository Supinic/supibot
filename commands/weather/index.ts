import { promisify } from "node:util";
import { exec } from "node:child_process";
import { SupiDate, SupiError } from "supi-core";

import { declare } from "../../classes/command.js";
import { fetchGeoLocationData, postToHastebin } from "../../utils/command-utils.js";

import {
	getSunPosition,
	isWeatherFormatKey,
	type OwmPollutionResponse,
	type OwmWeatherResponse,
	type WeatherFormatObject,
	WeatherItem
} from "./helpers.js";

const shell = promisify(exec);

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
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "alerts", type: "boolean" },
		{ name: "format", type: "string" },
		{ name: "latitude", type: "number" },
		{ name: "longitude", type: "number" },
		{ name: "pollution", type: "boolean" },
		{ name: "status", type: "string" },
		{ name: "radar", type: "boolean" }
	] as const,
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

		let skipLocation = false;
		let coords: { lat: number; lng: number; } | null = null;
		let formattedAddress: string | null = null;
		let isOwnLocation: boolean | null = null;

		if (typeof context.params.latitude === "number" || typeof context.params.longitude === "number") {
			const { latitude, longitude } = context.params;
			if (typeof latitude !== "number" || typeof longitude !== "number") {
				return {
					success: false,
					reply: `If using exact coordinates, you must specify both the latitude and the longitude!`
				};
			}

			if (latitude > 90 || latitude < -90) {
				return {
					success: false,
					reply: `Invalid latitude! Must be in range <-90, 90>`
				};
			}
			else if (longitude < -180 || longitude > 180) {
				return {
					success: false,
					reply: `Invalid longitude! Must be in range <-180, 180>`
				};
			}

			coords = {
				lat: latitude,
				lng: longitude
			};
		}
		else if (args.length === 0) {
			isOwnLocation = true;

			const location = await context.user.getDataProperty("location");
			if (location) {
				skipLocation = location.hidden;
				coords = location.coordinates;
				formattedAddress = location.formatted;
			}
			else {
				return {
					success: false,
					reply: `No place provided, and you don't have a default location set! You can use $set location (location) to set it, or add "private" to make it private 🙂`,
					cooldown: 2500
				};
			}
		}
		else if (args[0].startsWith("@")) {
			const userData = await sb.User.get(args[0]);
			isOwnLocation = (userData === context.user);

			if (!userData) {
				return {
					reply: "Invalid user provided!",
					cooldown: {
						length: 1000
					}
				};
			}

			if (userData.Name === context.platform.selfName) {
				let temperature;
				try {
					const result = await shell("vcgencmd measure_temp");
					const temperatureMatch = result.stdout.toString().match(/([\d.]+)/);
					if (temperatureMatch) {
						temperature = `${temperatureMatch[1]}°C`;
					}
				}
				catch (e) {
					console.warn(e);
					temperature = "Unknown temperature";
				}

				return {
					reply: `Supibot, Supinic's LACK table: ${temperature}. No wind detected. No precipitation expected.`
				};
			}

			const location = await userData.getDataProperty("location");
			if (!location) {
				return {
					reply: "That user did not set their location!",
					cooldown: {
						length: 2500
					}
				};
			}
			else {
				coords = location.coordinates;
				skipLocation = location.hidden;
				formattedAddress = location.formatted;
			}
		}

		if (!coords || !formattedAddress) {
			if (args.length === 0 && !coords) {
				return {
					reply: "No place or data provided!",
					cooldown: 2500
				};
			}

			type GeoCacheData = { empty: true } | {
				empty: false;
				formattedAddress: string;
				coords: { lat: number; lng: number; };
			};

			const location = args.join(" ");
			const cacheKey = (location)
				? `weather-location-${location}`
				: `weather-coords-${JSON.stringify(coords)}`;

			let geoData = await core.Cache.getByPrefix(cacheKey) as GeoCacheData | undefined;
			if (!geoData) {
				let data;
				if (coords) {
					data = await fetchGeoLocationData(coords);
				}
				else {
					data = await fetchGeoLocationData(args.join(" "));
				}

				if (!data.success) {
					geoData = { empty: true };
				}
				else {
					geoData = {
						empty: false,
						formattedAddress: data.formatted,
						coords: data.location
					};
				}

				await this.setCacheData(cacheKey, geoData, { expiry: 7 * 864e5 });
			}

			if (geoData.empty) {
				// Check if the location is actually someone's username
				const checkUserData = await sb.User.get(location);
				const checkLocation = await checkUserData?.getDataProperty("location");

				if (checkLocation) {
					return {
						success: false,
						reply: `That place was not found! However, you probably meant to check that user's location - make sure to add the @ symbol before their name.`,
						cooldown: 5000
					};
				}

				const emote = await context.getBestAvailableEmote(["peepoSadDank", "PepeHands", "FeelsBadMan"], "🙁");
				return {
					success: false,
					reply: `That place was not found! ${emote}`
				};
			}

			formattedAddress = geoData.formattedAddress;
			coords = geoData.coords;
		}

		if (!formattedAddress) {
			throw new SupiError({
			    message: "Assert error: Formatted address not filled"
			});
		}

		if (context.params.radar) {
			const lat = coords.lat.toFixed(4);
			const lng = coords.lng.toFixed(4);
			const message = `Weather radar for ${formattedAddress}: https://www.windy.com/-Weather-radar-radar?radar,${lat},${lng},6,d:picker`;
			if (skipLocation) {
				if (isOwnLocation) {
					await context.platform.pm(
						message,
						context.user,
						context.channel
					);

					return {
						reply: `I private messaged the radar link, as you have set your location to private.`
					};
				}
				else {
					return {
						success: false,
						reply: `Cannot show the radar for their location, as they have set it to private!`
					};
				}
			}
			else {
				return {
					reply: message
				};
			}
		}

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
			const index = data.main.aqi;

			const { components } = data;
			const place = (skipLocation) ? "(location hidden)" : formattedAddress;
			const icon = POLLUTION_INDEX_ICONS[index];

			const componentsString = Object.entries(components)
				.map(([type, value]) => `${type.toUpperCase().replace("_", ".")}: ${value.toFixed(3)}`)
				.join(", ");

			return {
				reply: core.Utils.tag.trim `
					${place} current pollution index: ${index} ${icon}
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
					reply: core.Utils.tag.trim `
						Weather alert summary for
						${(skipLocation) ? "(location hidden)" : formattedAddress}
						-
						no alerts.
					 `
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
					title: (skipLocation)
						? `Weather alerts - private location`
						: `Weather alerts - ${formattedAddress}`
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

			if (skipLocation) {
				if (isOwnLocation) {
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
						Weather alert summary for ${formattedAddress} - 
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
			place: (skipLocation) ? "(location hidden)" : formattedAddress,
			icon: target.icon,
			temperature: target.temperature,
			cloudCover: target.cloudCover,
			humidity: target.humidity,
			pressure: target.pressure,
			windSpeed: target.windSpeed,
			windGusts: target.windGusts,
			precipitation: target.precipitation,
			sun: (weatherTime.type === "current" && !skipLocation) ? getSunPosition(data) : ""
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

		if (!skipLocation) {
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

		`<code>${prefix}weather (place) radar:true</code>`,
		"Posts a link to a weather radar for the provided location. Uses Windy.com",
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
