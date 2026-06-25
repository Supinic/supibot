import { declare } from "../../classes/command.js";
import { getWeatherLocation } from "./location.js";
import { Owm3WeatherProvider, Owm4WeatherProvider } from "./providers/owm.js";
import { formatWeatherReport } from "./formatting.js";

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
const providers = {
	owm3: new Owm3WeatherProvider(),
	owm4: new Owm4WeatherProvider()
};
const currentProvider: keyof typeof providers = "owm3";

const determineReportType = (args: readonly string[]) => {
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		const hourMatch = arg.match(/^hour\+(\d+)/);
		if (hourMatch) {
			return {
				type: "hourly",
				offset: Number(hourMatch[1]),
				args: [...args.slice(0, i), ...args.slice(i + 1)]
			} as const;
		}

		const dayMatch = arg.match(/^day\+(\d+)/);
		if (dayMatch) {
			return {
				type: "daily",
				offset: Number(dayMatch[1]),
				args: [...args.slice(0, i), ...args.slice(i + 1)]
			} as const;
		}
	}

	return {
		type: "current",
		offset: null,
		args
	} as const;
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
	Code: (async function weather (context, ...args: readonly string[]) {
		const reportData = determineReportType(args);
		args = reportData.args;

		const locationResult = await getWeatherLocation(context, args);
		if ("command" in locationResult) {
			return locationResult.command;
		}

		const { coords, address, hidden, origin } = locationResult.location;
		if (context.params.pollution) {
			const pollution = await providers.owm3.fetchPollution(coords);
			if ("success" in pollution) {
				return pollution;
			}

			return {
				success: true,
				reply: core.Utils.tag.trim `
					${address} current pollution index: ${pollution.index} ${pollution.icon}
					Particles: ${pollution.components}.				
				`
			};
		}
		if (context.params.alerts) {
			const alerts = await providers.owm3.fetchAlerts(coords);
			if ("success" in alerts) {
				return alerts;
			}
			if (alerts.empty) {
				return {
					success: true,
					reply: `Weather alert summary for ${address} - no alerts.`
				};
			}

			if (hidden) {
				if (origin === "self") {
					await context.platform.pm(`Your location's weather alerts: ${alerts.link}`, context.user, context.channel);
					return {
						success: true,
						reply: core.Utils.tag.trim `
							Weather alert summary for your hidden location: ${alerts.amount} alerts.
							I sent you a private message with the link to the full description.
						`
					};
				}
				else {
					return {
						success: true,
						reply: `Weather alert summary for their hidden location: ${alerts.amount} alerts.`
					};
				}
			}
			else {
				return {
					success: true,
					reply: `Weather alert summary for ${address} - ${alerts.amount} alerts - full info: ${alerts.link}`
				};
			}
		}

		let data;
		const provider = providers[currentProvider];
		if (reportData.type === "current") {
			data = await provider.getCurrent(coords);
		}
		else if (reportData.type === "hourly") {
			data = await provider.getHourly(coords, reportData.offset);
		}
		else {
			data = await provider.getDaily(coords, reportData.offset);
		}

		if ("success" in data) {
			return data;
		}

		const { formatted } = formatWeatherReport(data, {
			place: address,
			hiddenLocation: hidden,
			customFormat: context.params.format
		});

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

		return {
			success: true,
			reply: formatted
		};
	}),
	Dynamic_Description: (prefix) => ([
		"Checks for current weather, or for hourly/daily forecast in a given location.",
		"If you, or a given user have set their location with the <code>set</code> command, this command supports that.",
		"",

		`<code>${prefix}weather (place)</code>`,
		"current weather in given location",
		"",

		`<code>${prefix}weather (place) <b>hour+X</b></code>`,
		"weather forecast in X hour(s) - accepts 0 (this hour) through 47 (in ~2 days).",
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

		`<code>${prefix}weather (place) format:(custom format)</code>`,
		`<code>${prefix}weather (place) format:temperature</code>`,
		`<code>${prefix}weather (place) format:temperature,humidity,pressure</code>`,
		"Lets you choose specific weather elements to show in the result.",
		`Supported elements: <code>${ALLOWED_FORMAT_TYPES.join(", ")}</code>`,
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
