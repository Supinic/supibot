import type { NumericCoordinates } from "../../../utils/globals.js";
import type { ResultFailure } from "../../../classes/command.js";

type BaseReport = {
	kind: "current" | "hourly" | "daily";
	timestamp: number;
	temperature: {
		actual: number;
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
type CurrentReport = BaseReport & {
	kind: "current";
	sun: {
		rise?: number;
		set?: number;
	};
};
type HourlyReport = BaseReport & {
	kind: "hourly";
	offset: number;
	time: string;
};
type DailyReport = BaseReport & {
	kind: "daily";
	offset: number;
	date: string;
	temperature: {
		actual: number;
		feelsLike: number;
		min: number;
		max: number;
	}
};

export interface WeatherProvider {
	readonly id: string;
	readonly name: string;

	getCurrent (coords: NumericCoordinates): Promise<CurrentReport | ResultFailure>;
	getHourly (coords: NumericCoordinates, offset: number): Promise<HourlyReport | ResultFailure>;
	getDaily (coords: NumericCoordinates, offset: number): Promise<DailyReport | ResultFailure>;
}
