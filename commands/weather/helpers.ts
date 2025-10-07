import { SupiDate } from "supi-core";
import weatherCodeData from "./codes.json" with { type: "json" };
const { codes } = weatherCodeData as { codes: Record<string, string | undefined> };

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
	minutely?: MinutelyWeatherDataItem[];
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

export type WeatherFormatObject = {
	cloudCover: string;
	humidity: string;
	icon: string;
	place: string;
	precipitation: string;
	pressure: string;
	sun: string;
	temperature: string;
	windGusts: string;
	windSpeed: string;
};
export const isWeatherFormatKey = (input: string, obj: WeatherFormatObject): input is keyof typeof obj => Object.hasOwn(obj, input);

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

export const getSunPosition = (data: OwmWeatherResponse) => {
	const nowSeconds = SupiDate.now() / 1000;
	let verb: "rise" | "set";
	let sunTime;

	if (nowSeconds < data.current.sunrise) {
		verb = "rise";
		sunTime = data.current.sunrise;
	}
	else if (nowSeconds < data.current.sunset) {
		verb = "set";
		sunTime = data.current.sunset;
	}
	else {
		verb = "rise";
		sunTime = data.daily[1].sunrise;
	}

	// Determine position based on sunrise/sunset data, if available directly
	if (sunTime !== 0) {
		return `Sun ${verb}s ${core.Utils.timeDelta(sunTime * 1000)}.`;
	}

	// Otherwise, try and determine whether the Sun is currently down or up based on UV index
	verb = (data.current.uvi === 0) ? "rise" : "set";
	const property: "sunrise" | "sunset" = `sun${verb}`;

	let time;
	for (const day of data.daily) {
		if (day[property]) {
			time = day[property];
			break;
		}
	}

	return (time)
		? `Sun ${verb}s ${core.Utils.timeDelta(time * 1000)}.`
		: `Sun does not ${verb} in the next 7 days.`;
};

export class WeatherItem {
	private item: WeatherDataItem;
	private minutes: MinutelyWeatherDataItem[];

	constructor (item: WeatherDataItem, minutes: MinutelyWeatherDataItem[]) {
		this.item = item;
		this.minutes = minutes;
	}

	get dt () {
		return this.item.dt;
	}

	get code () {
		const id = String(this.item.weather[0].id);
		return codes[id] ?? "(unknown icon)";
	}

	get icon () {
		return getIcon(this.item.weather[0].id, this.item);
	}

	get precipitation () {
		if (isDailyItem(this.item) || isHourlyItem(this.item)) {
			if (this.item.pop === 0) {
				return "No precipitation expected.";
			}
			else {
				const percent = `${core.Utils.round(this.item.pop * 100, 0)}%`;
				const rain = (isDailyItem(this.item)) ? this.item.rain : this.item.rain?.["1h"];
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

	get temperature () {
		return (isDailyItem(this.item))
			? `${this.item.temp.min}°C to ${this.item.temp.max}°C.`
			: `${this.item.temp}°C, feels like ${this.item.feels_like}°C.`;
	}

	get cloudCover () {
		return `Cloud cover: ${this.item.clouds}%.`;
	}

	get pressure () {
		return `Air pressure: ${this.item.pressure} hPa.`;
	}

	get humidity () {
		return `Humidity: ${this.item.humidity}%.`;
	}

	get windSpeed () {
		const direction = getWindDirection(this.item.wind_deg);
		return (this.item.wind_speed)
			? `${direction} wind speed: ${this.item.wind_speed} m/s.`
			: "No wind.";
	}

	get windGusts () {
		return (this.item.wind_gust)
			? `Wind gusts: ${this.item.wind_gust} m/s.`
			: "No wind gusts.";
	}
}
