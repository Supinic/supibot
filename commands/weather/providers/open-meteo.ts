import * as z from "zod";
import type { NumericCoordinates } from "../../../utils/globals.js";
import { type WeatherProvider, type WeatherReportType } from "./weather-template.js";
import type { ResultFailure } from "../../../classes/command.js";
import { type CacheValue, SupiDate } from "supi-core";

const WEATHER_ICONS: Partial<Record<number, string>> = {
	1: "🌤️️",
	2: "⛅",
	3: "☁️",
	45: "🌫️",
	48: "🌫️",
	51: "🌦️",
	53: "🌦️",
	55: "🌦️",
	56: "🌦️🧊",
	57: "🌦️🧊",
	61: "🌧️",
	63: "🌧️",
	65: "🌧️",
	66: "🌧️🧊",
	67: "🌧️🧊",
	71: "🌨️",
	73: "🌨️",
	75: "🌨️",
	77: "🌨️",
	80: "☔",
	81: "☔",
	82: "☔",
	85: "🌨️",
	86: "🌨️",
	95: "⛈️",
	96: "⛈️️🧊",
	97: "⛈️️🧊"
};
const getIcon = (code: number, isDay?: number) => {
	if (code === 0) {
		return (isDay === 0) ? "🌛" : "☀️";
	}

	return WEATHER_ICONS[code] ?? "";
};

const apiParams = {
	current: {
		current: "temperature_2m,weather_code,rain,snowfall,cloud_cover,apparent_temperature,relative_humidity_2m,is_day,wind_speed_10m,wind_gusts_10m"
	},
	hourly: {
		current: "",
		hourly: "temperature_2m,weather_code,precipitation_probability,rain,snowfall,cloud_cover,apparent_temperature"
	},
	daily: {
		current: "",
		daily: "temperature_2m_min,temperature_2m_max,weather_code,precipitation_probability_max,rain_sum,snowfall_sum"
	}
};

const currentSchema = z.object({
	utc_offset_seconds: z.number(),
	current: z.object({
		time: z.string(),
		temperature_2m: z.number(),
		apparent_temperature: z.number(),
		relative_humidity_2m: z.number(),
		cloud_cover: z.number(),
		rain: z.number(),
		snowfall: z.number(),
		wind_speed_10m: z.number(),
		wind_gusts_10m: z.number(),
		weather_code: z.number(),
		is_day: z.number() // 0 or 1
	})
});
const hourlySchema = z.object({
	utc_offset_seconds: z.number(),
	current: z.object({ time: z.string() }),
	hourly: z.object({
		time: z.array(z.string()),
		temperature_2m: z.array(z.number()),
		apparent_temperature: z.array(z.number()),
		precipitation_probability: z.array(z.number()),
		rain: z.array(z.number()),
		snowfall: z.array(z.number()),
		weather_code: z.array(z.number())
	})
});
const dailySchema = z.object({
	utc_offset_seconds: z.number(),
	current: z.object({ time: z.string() }),
	daily: z.object({
		time: z.array(z.string()),
		temperature_2m_min: z.array(z.number()),
		temperature_2m_max: z.array(z.number()),
		precipitation_probability_max: z.array(z.number()),
		rain_sum: z.array(z.number()),
		snowfall_sum: z.array(z.number()),
		weather_code: z.array(z.number())
	})
});

const isResultFailure = (input: unknown): input is ResultFailure => (
	input !== null && typeof input === "object"
	&& ("success" in input) && typeof input.success === "boolean"
	&& ("reply" in input) && typeof input.reply === "string"
);

const getCacheKey = (coords: NumericCoordinates, report: WeatherReportType) => `weather-cache-open-meteo-${report}-${coords.lat}-${coords.lng}`;

export class OpenMeteoProvider implements WeatherProvider {
	readonly id = "open-meteo";
	readonly name = "Open-Meteo";

	async getCurrent (coords: NumericCoordinates) {
		const { current } = apiParams.current;
		const body = await this.fetch(coords, "current", { current });
		if (isResultFailure(body)) {
			return body;
		}

		const data = currentSchema.parse(body).current;
		return {
			kind: "current" as const,
			timestamp: new SupiDate(data.time).valueOf(),
			temperature: {
				actual: data.temperature_2m,
				feels_like: data.apparent_temperature
			},
			condition: {
				code: data.weather_code,
				icon: getIcon(data.weather_code, data.is_day)
			},
			precipitation: {
				rain: data.rain,
				snow: data.snowfall
			},
			wind: {
				speed: data.wind_speed_10m,
				gust: data.wind_gusts_10m
			},
			humidity: data.relative_humidity_2m,
			cloudCover: data.cloud_cover
		};
	}

	async getHourly (coords: NumericCoordinates, offset: number) {
		const body = await this.fetch(coords, "hourly", apiParams.hourly);
		if (isResultFailure(body)) {
			return body;
		}

		const { hourly: data, current, utc_offset_seconds: timezoneOffset } = hourlySchema.parse(body);

		let startIndex = 0;
		const startDate = new SupiDate(current.time);
		for (let i = 0; i < data.time.length; i++) {
			const utcTime = new SupiDate(data.time[i]).valueOf();
			if (utcTime >= startDate.valueOf()) {
				startIndex = i;
				break;
			}
		}

		const off = startIndex + offset;
		const hour = data.time.at(off);

		if (!hour) {
			return {
				success: false,
				reply: "Invalid hour offset provided! Try a lower value."
			} as ResultFailure;
		}

		const base = new SupiDate(startDate).addHours(offset);
		const time = base.format("H:00");
		const timestamp = base.setTimezoneOffset(timezoneOffset).valueOf();
		return {
			kind: "hourly" as const,
			offset,
			time,
			timestamp,
			temperature: {
				actual: data.temperature_2m[off],
				feels_like: data.apparent_temperature[off]
			},
			condition: {
				code: data.weather_code[off],
				icon: getIcon(data.weather_code[off])
			},
			precipitation: {
				rain: data.rain[off],
				snow: data.snowfall[off],
				probability: data.precipitation_probability[off]
			},
			wind: {}
		};
	}

	async getDaily (coords: NumericCoordinates, offset: number) {
		const body = await this.fetch(coords, "daily", apiParams.daily);
		if (isResultFailure(body)) {
			return body;
		}

		const { daily: data, current, utc_offset_seconds: timezoneOffset } = dailySchema.parse(body);

		let startIndex = 0;
		const startDate = new SupiDate(`${current.time}Z`);
		for (let i = 0; i < data.time.length; i++) {
			const utcTime = new SupiDate(data.time[i]).valueOf();
			if (utcTime >= startDate.valueOf()) {
				startIndex = i;
				break;
			}
		}

		const off = startIndex + offset;
		const day = data.time.at(off);
		if (!day) {
			return {
				success: false,
				reply: "Invalid day offset provided! Try a lower value."
			} as ResultFailure;
		}

		const base = new SupiDate(startDate).addDays(offset);
		const date = base.format("j.n.");
		const timestamp = base.setTimezoneOffset(timezoneOffset).valueOf();
		return {
			kind: "daily" as const,
			offset,
			date,
			timestamp,
			temperature: {
				min: data.temperature_2m_min[off],
				max: data.temperature_2m_max[off]
			},
			condition: {
				code: data.weather_code[off],
				icon: getIcon(data.weather_code[off])
			},
			precipitation: {
				rain: data.rain_sum[off],
				snow: data.snowfall_sum[off],
				probability: data.precipitation_probability_max[off]
			},
			wind: {}
		};
	}

	private async fetch (coords: NumericCoordinates, report: WeatherReportType, params: Record<string, string>): Promise<unknown> {
		const cacheKey = getCacheKey(coords, report);
		const cacheData = await core.Cache.getByPrefix(cacheKey) as unknown;
		if (cacheData) {
			return cacheData;
		}

		const response = await core.Got.get("GenericAPI")({
			url: "https://api.open-meteo.com/v1/forecast",
			responseType: "json",
			throwHttpErrors: false,
			searchParams: {
				latitude: coords.lat,
				longitude: coords.lng,
				wind_speed_unit: "ms",
				models: "best_match",
				timezone: "auto",
				...params
			}
		});

		if (response.statusCode === 429) {
			return {
				success: false,
				reply: `The Open-Meteo API is currently unavailable due to too many requests! Try again later.`
			};
		}
		else if (!response.ok) {
			return {
				success: false,
				reply: `The Open-Meteo weather API is currently not available! Try again later.`
			};
		}

		await core.Cache.setByPrefix(cacheKey, response.body as CacheValue, { expiry: 600_000 });
		return response.body;
	}
}
