type BaseWeatherDataItem = {
	clouds: number;
	dew_point: number;
	dt: number;
	feels_like: number;
	humidity: number;
	pressure: number;
	sunrise: number;
	sunset: number;
	temp: number;
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
