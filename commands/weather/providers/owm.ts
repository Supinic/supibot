import * as z from "zod";
import { SupiDate, SupiError } from "supi-core";
import { degreeShape, percentShape, probabilityShape, unixTimestampShape } from "../../../utils/schemas.js";
import { postToHastebin } from "../../../utils/command-utils.js";
import { logger } from "../../../singletons/logger.js";
import type { NumericCoordinates } from "../../../utils/globals.js";
import type { ResultFailure } from "../../../classes/command.js";
import type { WeatherProvider, WeatherReportType } from "./weather-template.js";

const precipitationShape = z.object({
	"1h": z.number().nonnegative()
});
const weatherConditionSchema = z.object({
	id: z.number().int(),
	main: z.string(),
	description: z.string(),
	icon: z.string()
});

const baseWeatherDataItemSchema = z.object({
	dt: unixTimestampShape,
	clouds: percentShape,
	humidity: percentShape,
	pressure: z.number().nonnegative(),
	sunrise: unixTimestampShape.optional(),
	sunset: unixTimestampShape.optional(),
	uvi: z.number().nonnegative(),
	// visibility: z.number().nonnegative().optional(), // not used at the moment
	weather: z.array(weatherConditionSchema).nonempty().nullish(), // is null in OWM 4.0?
	wind_deg: degreeShape,
	wind_gust: z.number().nonnegative().optional(),
	wind_speed: z.number().nonnegative()
});
const minutelyWeatherDataItemSchema = z.object({
	dt: unixTimestampShape,
	precipitation: z.number().nonnegative()
});
const currentWeatherDataItemSchema = baseWeatherDataItemSchema.extend({
	feels_like: z.number(),
	temp: z.number(),
	rain: precipitationShape.optional(),
	snow: precipitationShape.optional()
});
const hourlyWeatherDataItemSchema = baseWeatherDataItemSchema.extend({
	feels_like: z.number(),
	temp: z.number(),
	rain: precipitationShape.optional(),
	snow: precipitationShape.optional(),
	pop: probabilityShape
});
const dailyWeatherDataItemSchema = baseWeatherDataItemSchema.extend({
	feels_like: z.object({
		day: z.number(),
		eve: z.number(),
		morn: z.number(),
		night: z.number()
	}),
	moon_phase: z.number().min(0).max(1),
	moonrise: unixTimestampShape,
	moonset: unixTimestampShape,
	pop: probabilityShape.optional(),
	rain: z.number().nonnegative().optional(),
	snow: z.number().nonnegative().optional(),
	temp: z.object({
		day: z.number(),
		eve: z.number(),
		morn: z.number(),
		night: z.number(),
		min: z.number(),
		max: z.number()
	})
});

type BaseDataItem = z.infer<typeof baseWeatherDataItemSchema>;
type CurrentDataItem = z.infer<typeof currentWeatherDataItemSchema>;
type MinuteDataItem = z.infer<typeof minutelyWeatherDataItemSchema>;
type HourlyDataItem = z.infer<typeof hourlyWeatherDataItemSchema>;
type DayDataItem = z.infer<typeof dailyWeatherDataItemSchema>;

const owmWeatherResponseSchema = z.object({
	current: currentWeatherDataItemSchema,
	daily: z.array(dailyWeatherDataItemSchema),
	hourly: z.array(hourlyWeatherDataItemSchema),
	minutely: z.array(minutelyWeatherDataItemSchema).optional(),
	timezone: z.string(),
	timezone_offset: z.number().int(),
	alerts: z.array(z.object({
		sender_name: z.string().optional(),
		event: z.string().optional(),
		description: z.string().optional(),
		tags: z.array(z.string()).optional(),
		start: unixTimestampShape,
		end: unixTimestampShape
	})).optional()
});
type Owm3Response = z.infer<typeof owmWeatherResponseSchema>;

const owmPollutionResponseSchema = z.object({
	list: z.array(z.object({
		dt: unixTimestampShape,
		main: z.object({
			aqi: z.union([
				z.literal(1),
				z.literal(2),
				z.literal(3),
				z.literal(4),
				z.literal(5)
			])
		}),
		components: z.object({
			co: z.number().nonnegative(),
			no: z.number().nonnegative(),
			no2: z.number().nonnegative(),
			o3: z.number().nonnegative(),
			so2: z.number().nonnegative(),
			pm2_5: z.number().nonnegative(),
			pm10: z.number().nonnegative(),
			nh3: z.number().nonnegative()
		})
	})).nonempty()
});

// Sourced from: https://openweathermap.org/weather-conditions
const WEATHER_ICONS: Partial<Record<number, string>> = {
	2: "⛈️", // Thunderstorm
	3: "🌧️", // Drizzle
	5: "🌧️", // Rain
	6: "🌨️", // Snow
	701: "🌫️", // Mist
	711: "🔥💨", // Smoke
	721: "🌫️", // Haze
	731: "🏜️💨", // Dust or sand whirls
	741: "🌫️", // Fog
	751: "🏜️💨", // Sand
	761: "🏜️💨", // Dust
	762: "🌋💨", // Volcanic ash
	771: "🌬️", // Squalls
	781: "🌪️", // Tornado
	801: "🌤️", // Few clouds (11-25%)
	802: "🌥️", // Scattered clouds (25-50%)
	803: "☁️", // Broken clouds (51-84%)
	804: "☁️" // Overcast clouds (85-100%)
};
const POLLUTION_INDEX_ICONS = {
	1: "🔵",
	2: "🟢",
	3: "🟡",
	4: "🟠",
	5: "🔴"
};

const getIcon = (code: number, icon?: string) => {
	if (code === 800) {
		return (icon?.endsWith("n")) ? "🌙" : "☀️";
	}

	const shortCode = Math.trunc(code / 100);
	return WEATHER_ICONS[code] ?? WEATHER_ICONS[shortCode] ?? "";
};
const getClosestPrecipitation = (minutes: z.infer<typeof minutelyWeatherDataItemSchema>[]) => {
	const start = new SupiDate().discardTimeUnits("s", "ms");
	for (const { dt, precipitation: pr } of minutes) {
		if (pr === 0) {
			continue;
		}

		const when = new SupiDate(dt * 1000).discardTimeUnits("s", "ms").valueOf();
		const minuteIndex = Math.trunc(when - start.valueOf()) / 60_000;
		if (minuteIndex < 1) {
			return "Precipitation expected in less than a minute!";
		}
		else {
			const plural = (minuteIndex === 1) ? "" : "s";
			return `Precipitation expected in ~${minuteIndex} minute${plural}.`;
		}
	}

	return "No precipitation expected";
};

const getOwmApiKey = (): string => {
	if (!process.env.API_OPEN_WEATHER_MAP) {
		throw new SupiError({
			message: "No OWM API key configured (API_OPEN_WEATHER_MAP)"
		});
	}

	return process.env.API_OPEN_WEATHER_MAP;
};
const getOwm3CacheKey = (coords: NumericCoordinates) => `weather-cache-owm-3.0-${coords.lat}-${coords.lng}`;
const getOwm4CacheKey = (coords: NumericCoordinates, report: WeatherReportType) => `weather-cache-owm-4.0-${coords.lat}-${coords.lng}-${report}`;

const parseCommonReportFields = (item: BaseDataItem) => {
	const status = item.weather?.[0];
	return {
		timestamp: item.dt,
		humidity: item.humidity,
		cloudCover: item.clouds,
		pressure: item.pressure,
		uvi: item.uvi,
		condition: {
			code: status?.id ?? 0,
			icon: (status) ? getIcon(status.id, status.icon) : ""
		},
		wind: {
			speed: item.wind_speed,
			gust: item.wind_gust,
			direction: item.wind_deg
		}
	};
};
const parseCurrentReport = (item: CurrentDataItem, minutely?: MinuteDataItem[]) => ({
	kind: "current" as const,
	...parseCommonReportFields(item),
	temperature: {
		actual: item.temp,
		feelsLike: item.feels_like
	},
	precipitation: {
		rain: item.rain?.["1h"],
		snow: item.snow?.["1h"],
		timeUntil: (minutely) ? getClosestPrecipitation(minutely) : undefined
	},
	sun: {
		rise: item.sunrise,
		set: item.sunset
	}
});
const parseHourlyReport = (items: HourlyDataItem[], timezoneOffset: number, offset: number) => {
	const item = items.at(offset);
	if (!item) {
		return {
			success: false,
			reply: "No data found for this offset! Try a lower number."
		} as const;
	}

	const date = new SupiDate(item.dt * 1000).setTimezoneOffset(timezoneOffset / 60);
	return {
		kind: "hourly" as const,
		offset,
		time: date.format("H:00"),
		...parseCommonReportFields(item),
		temperature: {
			actual: item.temp,
			feelsLike: item.feels_like
		},
		precipitation: {
			rain: item.rain?.["1h"],
			snow: item.snow?.["1h"],
			probability: item.pop
		}
	};
};
const parseDailyReport = (items: DayDataItem[], timezoneOffset: number, offset: number) => {
	const item = items.at(offset);
	if (!item) {
		return {
			success: false,
			reply: "No data found for this offset! Try a lower number."
		} as const;
	}

	const date = new SupiDate(item.dt * 1000).setTimezoneOffset(timezoneOffset / 60);
	return {
		kind: "daily" as const,
		offset,
		date: date.format("j.n."),
		...parseCommonReportFields(item),
		temperature: {
			actual: item.temp.day,
			feelsLike: item.feels_like.day,
			min: item.temp.min,
			max: item.temp.max
		},
		precipitation: {
			rain: item.rain,
			snow: item.snow,
			probability: item.pop
		}
	};
};

type AlertsData = { empty: true; } | { empty: false; amount: number; link: string; } | ResultFailure;
type PollutionData = { icon: string; index: number; components: string; } | ResultFailure;

export class Owm3WeatherProvider implements WeatherProvider {
	readonly id = "owm3";
	readonly name = "OpenWeatherMap 3.0";

	async getCurrent (coords: NumericCoordinates) {
		const data = await this.oneCall(coords);
		if ("success" in data) {
			return data;
		}

		return parseCurrentReport(data.current, data.minutely);
	}

	async getHourly (coords: NumericCoordinates, offset: number) {
		if (!Number.isSafeInteger(offset) || offset < 0 || offset > 19) {
			return {
				success: false,
				reply: "Invalid hour offset provided! Use a value between 0 and 19."
			} as ResultFailure;
		}

		const data = await this.oneCall(coords);
		if ("success" in data) {
			return data;
		}

		return parseHourlyReport(data.hourly, data.timezone_offset, offset);
	}

	async getDaily (coords: NumericCoordinates, offset: number) {
		if (!Number.isSafeInteger(offset) || offset < 0 || offset > 7) {
			return {
				success: false,
				reply: "Invalid day offset provided! Use a value between 0 and 7."
			} as const;
		}

		const data = await this.oneCall(coords);
		if ("success" in data) {
			return data;
		}

		return parseDailyReport(data.daily, data.timezone_offset, offset);
	}

	async fetchAlerts (coords: NumericCoordinates): Promise<AlertsData> {
		const data = await this.oneCall(coords);
		if ("success" in data) {
			return data;
		}

		if (!data.alerts || data.alerts.length === 0) {
			return {
				empty: true
			};
		}

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

		const paste = await postToHastebin(text, { title: `Weather alerts` });

		if (!paste.ok) {
			return {
				success: false,
				reply: paste.reason
			} as ResultFailure;
		}

		return {
			empty: false,
			amount: data.alerts.length,
			link: paste.link
		};
	}

	async fetchPollution (coords: NumericCoordinates): Promise<PollutionData> {
		const response = await core.Got.get("GenericAPI")({
			url: "https://api.openweathermap.org/data/2.5/air_pollution",
			responseType: "json",
			throwHttpErrors: false,
			timeout: {
				request: 60_000
			},
			searchParams: {
				lat: coords.lat,
				lon: coords.lng,
				appid: getOwmApiKey()
			}
		});
		if (response.statusCode === 429) {
			return {
				success: false,
				reply: `The pollution API is currently unavailable due to too many requests! Try again later.`
			} as const;
		}
		else if (!response.ok) {
			return {
				success: false,
				reply: `The pollution API is currently not available! Try again later.`
			} as const;
		}

		const [data] = owmPollutionResponseSchema.parse(response.body).list;
		const index = data.main.aqi;
		const { components } = data;
		const icon = POLLUTION_INDEX_ICONS[index];

		const componentsString = Object.entries(components)
			.map(([type, value]) => `${type.toUpperCase().replace("_", ".")}: ${value.toFixed(3)}`)
			.join(", ");

		return {
			icon,
			index,
			components: componentsString
		};
	}

	private async oneCall (coords: NumericCoordinates): Promise<Owm3Response | ResultFailure> {
		const cacheKey = getOwm3CacheKey(coords);
		const cacheData = await core.Cache.getByPrefix(cacheKey) as Owm3Response | null;
		if (cacheData) {
			return cacheData;
		}

		const apiKey = getOwmApiKey();
		const response = await core.Got.get("GenericAPI")({
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
				appid: apiKey
			}
		});

		if (response.statusCode === 429) {
			return {
				success: false,
				reply: `The weather API is currently unavailable due to too many requests! Try again later.`
			};
		}
		else if (!response.ok) {
			return {
				success: false,
				reply: `The weather API is currently not available! Try again later.`
			};
		}

		const rawData = owmWeatherResponseSchema.safeParse(response.body);
		if (!rawData.success) {
			await logger.logError("Command", rawData.error, {
				origin: "Internal", // Internal so it comes out as a notification in Error_Inbox
				arguments: { coords },
				context: {
					cause: "OWM3 Zod error",
					body: response.body
				}
			});

			return {
				success: false,
				reply: "The weather provider returned invalid data! Try again after an hour or so, please."
			};
		}

		const { data } = rawData;
		await core.Cache.setByPrefix(cacheKey, data satisfies Owm3Response, { expiry: 10 * 60_000 });
		return data;
	}
}

const current4ResponseSchema = z.object({
	data: z.array(currentWeatherDataItemSchema).nonempty()
});
const hourly4ResponseSchema = z.object({
	data: z.array(hourlyWeatherDataItemSchema),
	timezone: z.string(),
	timezone_offset: z.number().int()
});
const daily4ResponseSchema = z.object({
	data: z.array(dailyWeatherDataItemSchema.extend({
		weather: z.null().optional(),
		pop: z.number().optional() // is never present
	})),
	timezone: z.string(),
	timezone_offset: z.number().int()
});

type Hourly4DataResponse = z.infer<typeof hourly4ResponseSchema>;
type Daily4DataResponse = z.infer<typeof daily4ResponseSchema>;

export class Owm4WeatherProvider implements WeatherProvider {
	readonly id = "owm4";
	readonly name = "OpenWeatherMap 4.0";

	async getCurrent (coords: NumericCoordinates) {
		const data = await this.fetch("current", coords);
		if ("success" in data) {
			return data;
		}

		return parseCurrentReport(data);
	}

	async getHourly (coords: NumericCoordinates, offset: number) {
		if (!Number.isSafeInteger(offset) || offset < 0 || offset > 47) {
			return {
				success: false,
				reply: "Invalid hour offset provided! Use a value between 0 and 47."
			} as const;
		}

		// always shift the starting point to the given hour, and change the result offset to 0
		const now = new SupiDate().discardTimeUnits("m", "s", "ms");
		const start = Math.trunc(now.addHours(offset).valueOf() / 1000);
		const data = await this.fetch("hourly", coords, start);
		if ("success" in data) {
			return data;
		}

		return parseHourlyReport(data.data, data.timezone_offset, 0);
	}

	async getDaily (coords: NumericCoordinates, offset: number) {
		if (!Number.isSafeInteger(offset) || offset < 0 || offset > 9) {
			return {
				success: false,
				reply: "Invalid hour offset provided! Use a value between 0 and 10."
			} as const;
		}

		const data = await this.fetch("daily", coords);
		if ("success" in data) {
			return data;
		}

		return parseDailyReport(data.data, data.timezone_offset, offset);
	}

	private async fetch (type: "current", coords: NumericCoordinates): Promise<CurrentDataItem | ResultFailure>;
	private async fetch (type: "hourly", coords: NumericCoordinates, start?: number): Promise<Hourly4DataResponse | ResultFailure>;
	private async fetch (type: "daily", coords: NumericCoordinates): Promise<Daily4DataResponse | ResultFailure>;
	private async fetch (type: WeatherReportType, coords: NumericCoordinates, start?: number): Promise<CurrentDataItem | Hourly4DataResponse | Daily4DataResponse | ResultFailure> {
		const cacheKey = getOwm4CacheKey(coords, type);
		const cacheData = await core.Cache.getByPrefix(cacheKey);
		if (cacheData) {
			if (type === "current") {
				return cacheData as CurrentDataItem;
			}
			else if (type === "hourly") {
				return cacheData as Hourly4DataResponse;
			}
			else {
				return cacheData as Daily4DataResponse;
			}
		}

		let response;
		const apiKey = getOwmApiKey();
		if (type === "current") {
			response = await core.Got.get("GenericAPI")({
				url: "https://api.openweathermap.org/data/4.0/onecall/current",
				responseType: "json",
				throwHttpErrors: false,
				timeout: {
					request: 60_000
				},
				searchParams: {
					lat: coords.lat,
					lon: coords.lng,
					units: "metric",
					appid: apiKey
				}
			});
		}
		else if (type === "hourly") {
			const searchParams = new URLSearchParams({
				lat: String(coords.lat),
				lon: String(coords.lng),
				units: "metric",
				appid: apiKey
			});

			if (start) {
				searchParams.set("start", String(start));
			}

			response = await core.Got.get("GenericAPI")({
				url: "https://api.openweathermap.org/data/4.0/onecall/timeline/1h",
				responseType: "json",
				throwHttpErrors: false,
				timeout: {
					request: 60_000
				},
				searchParams: searchParams.toString()
			});
		}
		else {
			response = await core.Got.get("GenericAPI")({
				url: "https://api.openweathermap.org/data/4.0/onecall/timeline/1day",
				responseType: "json",
				throwHttpErrors: false,
				timeout: {
					request: 60_000
				},
				searchParams: {
					lat: coords.lat,
					lon: coords.lng,
					units: "metric",
					appid: apiKey
				}
			});
		}

		if (response.statusCode === 429) {
			return {
				success: false,
				reply: `The weather API is currently unavailable due to too many requests! Try again later.`
			};
		}
		else if (!response.ok) {
			return {
				success: false,
				reply: `The weather API is currently not available! Try again later.`
			};
		}

		let data;
		if (type === "current") {
			data = current4ResponseSchema.parse(response.body).data[0];
		}
		else if (type === "hourly") {
			data = hourly4ResponseSchema.parse(response.body);
		}
		else {
			data = daily4ResponseSchema.parse(response.body);
		}

		await core.Cache.setByPrefix(cacheKey, data, { expiry: 10 * 60_000 });
		return data;
	}
}
