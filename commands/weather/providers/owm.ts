import * as z from "zod";
import { SupiDate, SupiError } from "supi-core";
import { degreeShape, percentShape, probabilityShape, unixTimestampShape } from "../../../utils/schemas.js";
import type { NumericCoordinates } from "../../../utils/globals.js";
import type { WeatherProvider, WeatherReportType } from "./provider.js";
import type { ResultFailure } from "../../../classes/command.js";

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
	dew_point: z.number(),
	humidity: percentShape,
	pressure: z.number().nonnegative(),
	sunrise: unixTimestampShape.optional(),
	sunset: unixTimestampShape.optional(),
	uvi: z.number().nonnegative(),
	// visibility: z.number().nonnegative().optional(), // not used at the moment
	weather: z.array(weatherConditionSchema).nonempty(),
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
	pop: probabilityShape,
	rain: z.number().nonnegative().optional(),
	snow: z.number().nonnegative().optional(),
	summary: z.string(),
	temp: z.object({
		day: z.number(),
		eve: z.number(),
		morn: z.number(),
		night: z.number(),
		min: z.number(),
		max: z.number()
	})
});

const owmWeatherResponseSchema = z.object({
	current: currentWeatherDataItemSchema,
	daily: z.array(dailyWeatherDataItemSchema),
	hourly: z.array(hourlyWeatherDataItemSchema),
	minutely: z.array(minutelyWeatherDataItemSchema).optional(),
	timezone: z.string(),
	timezone_offset: z.number().int()
});
type Owm3Response = z.infer<typeof owmWeatherResponseSchema>;

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

const parseCommonReportFields = (item: z.infer<typeof baseWeatherDataItemSchema>) => {
	const status = item.weather[0];
	return {
		timestamp: item.dt,

		humidity: item.humidity,
		cloudCover: item.clouds,
		pressure: item.pressure,
		uvi: item.uvi,

		condition: {
			code: status.id,
			icon: getIcon(status.id, status.icon)
		},

		wind: {
			speed: item.wind_speed,
			gust: item.wind_gust,
			direction: item.wind_deg
		}
	};
};
const parseCurrentReport = (item: z.infer<typeof currentWeatherDataItemSchema>, minutely?: z.infer<typeof minutelyWeatherDataItemSchema>[]) => ({
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
const parseHourlyReport = (items: z.infer<typeof hourlyWeatherDataItemSchema>[], timezoneOffset: number, offset: number) => {
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
const parseDailyReport = (items: z.infer<typeof dailyWeatherDataItemSchema>[], timezoneOffset: number, offset: number) => {
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

export class Owm3WeatherProvider implements WeatherProvider {
	readonly id = "owm3";
	readonly name = "OpenWeatherMap 3.0";

	async getCurrent (coords: NumericCoordinates) {
		const data = await this.oneCall(coords);
		if ("success" in data) {
			return data;
		}

		return parseCurrentReport(data.current);
	}

	async getHourly (coords: NumericCoordinates, offset: number) {
		if (!Number.isSafeInteger(offset) || offset < 0 || offset > 47) {
			return {
				success: false,
				reply: "Invalid hour offset provided! Use a value between 0 and 47."
			} as const;
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

		const data = owmWeatherResponseSchema.parse(response.body);
		await core.Cache.setByPrefix(cacheKey, data satisfies Owm3Response, { expiry: 10 * 60_000 });

		return data;
	}
}

const current4ResponseSchema = z.object({
	data: z.array(currentWeatherDataItemSchema)
});
const hourly4ResponseSchema = z.object({
	data: z.array(hourlyWeatherDataItemSchema),
	timezone: z.string(),
	timezone_offset: z.number().int()
});
const daily4ResponseSchema = z.object({
	data: z.array(dailyWeatherDataItemSchema),
	timezone: z.string(),
	timezone_offset: z.number().int()
});

export class Owm4WeatherProvider implements WeatherProvider {
	readonly id = "owm4";
	readonly name = "OpenWeatherMap 4.0";

	async getCurrent (coords: NumericCoordinates) {
		const cacheKey = getOwm4CacheKey(coords, "current");
		let data = await core.Cache.getByPrefix(cacheKey) as z.infer<typeof currentWeatherDataItemSchema> | null;
		if (!data) {
			const apiKey = getOwmApiKey();
			const response = await core.Got.get("GenericAPI")({
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

			data = current4ResponseSchema.parse(response.body).data[0];
		}

		await core.Cache.setByPrefix(cacheKey, data satisfies z.infer<typeof currentWeatherDataItemSchema>, { expiry: 10 * 60_000 });

		return parseCurrentReport(data);
	}

	async getHourly (coords: NumericCoordinates, offset: number) {
		if (!Number.isSafeInteger(offset) || offset < 0 || offset > 20) {
			return {
				success: false,
				reply: "Invalid hour offset provided! Use a value between 0 and 20."
			} as const;
		}

		const cacheKey = getOwm4CacheKey(coords, "hourly");
		let data = await core.Cache.getByPrefix(cacheKey) as z.infer<typeof hourly4ResponseSchema> | null;
		if (!data) {
			const apiKey = getOwmApiKey();
			const response = await core.Got.get("GenericAPI")({
				url: "https://api.openweathermap.org/data/4.0/onecall/timeline/1h",
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

			data = hourly4ResponseSchema.parse(response.body);
		}

		await core.Cache.setByPrefix(cacheKey, data, { expiry: 10 * 60_000 });

		return parseHourlyReport(data.data, data.timezone_offset, offset);
	}

	async getDaily (coords: NumericCoordinates, offset: number) {
		if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10) {
			return {
				success: false,
				reply: "Invalid hour offset provided! Use a value between 0 and 10."
			} as const;
		}

		const cacheKey = getOwm4CacheKey(coords, "daily");
		let data = await core.Cache.getByPrefix(cacheKey) as z.infer<typeof daily4ResponseSchema> | null;
		if (!data) {
			const apiKey = getOwmApiKey();
			const response = await core.Got.get("GenericAPI")({
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

			data = daily4ResponseSchema.parse(response.body);
		}

		await core.Cache.setByPrefix(cacheKey, data, { expiry: 10 * 60_000 });

		return parseDailyReport(data.data, data.timezone_offset, offset);
	}
}
