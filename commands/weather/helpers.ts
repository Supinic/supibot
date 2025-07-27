import { SupiDate } from "supi-core";

type BaseWeatherDataItem = {
	clouds: number;
	dew_point: number;
	dt: number;
	humidity: number;
	pressure: number;
	sunrise: number;
	sunset: number;
	uvi: number;
	visibility: number;
	weather: {
		id: number;
		main: string;
		description: string;
		icon: string;
	}[];
	wind_deg: number;
	wind_gust: number;
	wind_speed: number;
};
type CurrentWeatherDataItem = BaseWeatherDataItem & {
	feels_like: number;
	temp: number;
	rain?: { "1h": number; };
	snow?: { "1h": number; };
};
type DailyWeatherDataItem = BaseWeatherDataItem & {
	feels_like: {
		day: number;
		eve: number;
		morn: number;
		night: number;
	};
	moon_phase: number;
	moonrise: number;
	moonset: number;
	pop: number;
	rain?: number;
	snow?: number;
	summary: string;
	temp: {
		day: number;
		eve: number;
		morn: number;
		night: number;
		min: number;
		max: number;
	};
}
type HourlyWeatherDataItem = BaseWeatherDataItem & {
	feels_like: number;
	temp: number;
	rain?: { "1h": number; };
	snow?: { "1h": number; };
	pop: number;
};
type MinutelyWeatherDataItem = {
	dt: number;
	precipitation: number;
};
export type WeatherDataItem = CurrentWeatherDataItem | DailyWeatherDataItem | HourlyWeatherDataItem;

export const isCurrentItem = (input: WeatherDataItem): input is CurrentWeatherDataItem => (!Object.hasOwn(input, "pop"));
export const isDailyItem = (input: WeatherDataItem): input is DailyWeatherDataItem => (Object.hasOwn(input, "summary"));
export const isHourlyItem = (input: WeatherDataItem): input is HourlyWeatherDataItem => (
	!isDailyItem(input)
	&& Object.hasOwn(input, "pop")
);

type WeatherAlert = {
	start: number;
	end: number;
	event?: string;
	description?: string;
	sender_name?: string;
	tags?: string[];
};
export type OwmWeatherResponse = {
	current: CurrentWeatherDataItem;
	daily: DailyWeatherDataItem[];
	hourly: HourlyWeatherDataItem[];
	minutely: MinutelyWeatherDataItem[];
	lat: number;
	lon: number;
	timezone: string;
	timezone_offset: number;
	alerts?: WeatherAlert[];
};
export type OwmPollutionResponse = {
	coord: { lat: number; lon: number; };
	list: {
		dt: number;
		main: { aqi: 3 };
		components: {
			co: number;
			nh3: number;
			no: number;
			no2: number;
			o3: number;
			pm2_5: number;
			pm10: number;
			so2: number;
		};
	}[];
};

/* eslint-disable quote-props */
// Sourced from: https://openweathermap.org/weather-conditions
const WEATHER_ICONS = {
	"2": "⛈️", // Thunderstorm
	"3": "🌧️", // Drizzle
	"5": "🌧️", // Rain
	"6": "🌨️", // Snow
	"701": "🌫️", // Mist
	"711": "🔥💨", // Smoke
	"721": "🌫️", // Haze
	"731": "🏜️💨", // Dust or sand whirls
	"741": "🌫️", // Fog
	"751": "🏜️💨", // Sand
	"761": "🏜️💨", // Dust
	"762": "🌋💨", // Volcanic ash
	"771": "🌬️", // Squalls
	"781": "🌪️", // Tornado
	"801": "🌤️", // Few clouds (11-25%)
	"802": "🌥️", // Scattered clouds (25-50%)
	"803": "☁️", // Broken clouds (51-84%)
	"804": "☁️" // Overcast clouds (85-100%)
} as const;

const clearSkyFunction = (current?: { uvi: number }) => (current?.uvi === 0) ? "🌙" : "☀️"; // Clear sky

const isWeatherIcon = (input: number | string): input is keyof typeof WEATHER_ICONS => (
	Object.keys(WEATHER_ICONS).includes(String(input))
);

const WIND_DIRECTIONS = ["NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

export const getIcon = (code: number, current: WeatherDataItem) => {
	if (code === 800) {
		return clearSkyFunction(current);
	}

	const shortCode = Math.trunc(code / 100);
	if (isWeatherIcon(shortCode)) {
		return WEATHER_ICONS[shortCode];
	}
	else if (isWeatherIcon(code)) {
		return WEATHER_ICONS[code];
	}
	else {
		return "";
	}
};

export const getWindDirection = (degrees: number) => {
	degrees %= 360;

	const base = 11.25;
	const interval = 22.5;
	if (degrees < base || degrees >= (360 - base)) {
		return "N";
	}

	// It is guaranteed that the value (0-359) is going to fall between the 15 different wind directions, so always `string`
	const index = Math.trunc((degrees - base) / interval);
	return WIND_DIRECTIONS.at(index) as string;
};

export class WeatherItem {
	constructor (type: "current", item: CurrentWeatherDataItem, minutes: MinutelyWeatherDataItem[]);
	constructor (type: "hourly", item: HourlyWeatherDataItem, minutes: MinutelyWeatherDataItem[]);
	constructor (type: "daily", item: DailyWeatherDataItem, minutes: MinutelyWeatherDataItem[]);
	constructor (private type: "current" | "hourly" | "daily", private item: WeatherDataItem, private minutes: MinutelyWeatherDataItem[]) {}

	get precipitation () {
		if (isDailyItem(this.item) || isHourlyItem(this.item)) {
			if (this.item.pop === 0) {
				return "No precipitation expected.";
			}
			else {
				const percent = `${core.Utils.round(this.item.pop * 100, 0)}%`;
				const rain = (this.type === "daily") ? this.item.rain : this.item.rain?.["1h"];
				const snow = (isDailyItem(this.item)) ? this.item.snow : this.item.snow?.["1h"];

				if (rain && snow) {
					return `${percent} chance of combined rain (${rain}mm/hr) and snow (${snow}mm/h).`;
				}
				else if (rain) {
					return `${percent} chance of ${rain}mm/h rain.`;
				}
				else if (snow) {
					return `${percent} chance of ${snow}mm/h snow.`;
				}
				else {
					return `${percent} chance of precipitation.`;
				}
			}
		}
		else {
			const rain = this.item.rain?.["1h"] ?? null;
			const snow = this.item.snow?.["1h"] ?? null;

			if (rain && snow) {
				return `It is currently raining (${rain}mm/h) and snowing (${snow}mm/h).`;
			}
			else if (rain) {
				return `It is currently raining, ${rain}mm/h.`;
			}
			else if (snow) {
				return `It is currently snowing, ${snow}mm/h.`;
			}
			else {
				const start = new SupiDate().discardTimeUnits("s", "ms");
				for (const { dt, precipitation: pr } of this.minutes) {
					if (pr !== 0) {
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
				}
			}

			return "No precipitation expected.";
		}
	}
}
