import type { NumericCoordinates } from "../../../utils/globals.js";
import type { ResultFailure } from "../../../classes/command.js";

export type WeatherReportType = "current" | "hourly" | "daily";
type BaseWeatherReport = {
	kind: WeatherReportType;
	timestamp: number;
	temperature: {
		actual?: number;
		feelsLike?: number;
		min?: number;
		max?: number;
	};
	condition: {
		code: number;
		icon?: string;
		label?: string;
	};
	precipitation?: {
		amount?: number;
		probability?: number;
		rain?: number;
		snow?: number;
		timeUntil?: string;
	};
	wind?: {
		speed?: number;
		gust?: number;
		direction?: number;
	};
	sun?: {
		rise?: number;
		set?: number;
	};
	humidity?: number;
	cloudCover?: number;
	pressure?: number;
	uvi?: number;
};
type CurrentWeatherReport = BaseWeatherReport & {
	kind: "current";
	temperature: { actual: number; }
};
type HourlyWeatherReport = BaseWeatherReport & {
	kind: "hourly";
	offset: number;
	time: string;
	temperature: { actual: number; }
};
type DailyWeatherReport = BaseWeatherReport & {
	kind: "daily";
	offset: number;
	date: string;
	temperature: {
		min: number;
		max: number;
	}
};
export type WeatherReport = CurrentWeatherReport | HourlyWeatherReport | DailyWeatherReport;

export type WeatherProviderName = "owm3" | "owm4" | "open-meteo";
const currentWeatherProviderCacheKey = "weather-current-provider";

export const getCurrentWeatherProvider = () => "open-meteo" as const;
// export const getCurrentWeatherProvider = async () => {
// 	const value = await core.Cache.getByPrefix(currentWeatherProviderCacheKey) as WeatherProviderName | null;
// 	if (value) {
// 		return value;
// 	}
//
// 	await setCurrentWeatherProvider("owm3");
// 	return "owm3";
// };
export const setCurrentWeatherProvider = async (name: WeatherProviderName) => {
	await core.Cache.setByPrefix(currentWeatherProviderCacheKey, name);
};

export interface WeatherProvider {
	readonly id: string;
	readonly name: string;

	getCurrent (coords: NumericCoordinates): Promise<CurrentWeatherReport | ResultFailure>;
	getHourly (coords: NumericCoordinates, offset: number): Promise<HourlyWeatherReport | ResultFailure>;
	getDaily (coords: NumericCoordinates, offset: number): Promise<DailyWeatherReport | ResultFailure>;
}
