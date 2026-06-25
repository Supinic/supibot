import { SupiDate } from "supi-core";
import type { WeatherReport, WeatherReport as Report } from "./providers/provider.js";

export const WEATHER_FORMAT_KEYS = [
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
] as const;
type WeatherFormatKey = typeof WEATHER_FORMAT_KEYS[number];
const isWeatherFormatKey = (input: string): input is WeatherFormatKey => WEATHER_FORMAT_KEYS.includes(input as WeatherFormatKey);

const WIND_DIRECTIONS = ["NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const windDirectionInterval = 22.5;
const getWindDirection = (degrees: number) => {
	degrees %= 360;

	const base = 11.25;
	if (degrees < base || degrees >= (360 - base)) {
		return "N";
	}

	// It is guaranteed that the value (0-359) is going to fall between the 15 different wind directions, so always `string`
	const index = Math.trunc((degrees - base) / windDirectionInterval);
	return WIND_DIRECTIONS.at(index) as string;
};

type WeatherFormatObject = Record<WeatherFormatKey, string>;
type WeatherFormatMeta = {
	place: string;
	hiddenLocation?: boolean;
};

const formatTemperature = (report: Report) => {
	if (report.kind === "daily") {
		return `${report.temperature.min}°C to ${report.temperature.max}°C.`;
	}

	const actual = `${report.temperature.actual}°C`;
	return (typeof report.temperature.feelsLike === "number")
		? `${actual}, feels like ${report.temperature.feelsLike}°C`
		: actual;
};
const formatCloudCover = (report: Report) => (typeof report.cloudCover === "number") ? `Cloud cover: ${report.cloudCover}%.` : "";
const formatHumidity = (report: Report) => (typeof report.humidity === "number") ? `Humidity: ${report.humidity}%.` : "";
const formatPressure = (report: Report) => (typeof report.pressure === "number") ? `Air pressure: ${report.pressure} hPa.` : "";
const formatWindSpeed = (report: Report) => {
	const speed = report.wind?.speed;
	if (!speed) {
		return "No wind.";
	}

	const direction = report.wind?.direction;
	const directionText = (typeof direction === "number") ? `${getWindDirection(direction)} wind` : "Wind";
	return `${directionText} speed: ${speed} m/s.`;
};
const formatWindGusts = (report: Report) => (report.wind?.gust) ? `Wind gusts: ${report.wind.gust} m/s.` : "No wind gusts.";
const formatPrecipitation = (report: Report) => {
	const precipitation = report.precipitation;
	if (!precipitation) {
		return "No precipitation expected.";
	}

	const { rain, snow, probability, timeUntil } = precipitation;
	if (report.kind === "current") {
		if (rain && snow) {
			return `It is currently raining (${rain} mm/h) and snowing (${snow} mm/h).`;
		}
		else if (rain) {
			return `It is currently raining, ${rain} mm/h.`;
		}
		else if (snow) {
			return `It is currently snowing, ${snow} mm/h.`;
		}
		else if (timeUntil) {
			return timeUntil;
		}

		return "No precipitation expected.";
	}

	if (!probability) {
		return "No precipitation expected.";
	}

	const percent = `${core.Utils.round(probability * 100, 0)}%`;
	if (rain && snow) {
		return `${percent} chance of combined rain (${rain} mm/h) and snow (${snow} mm/h).`;
	}
	else if (rain) {
		return `${percent} chance of ${rain} mm/h rain.`;
	}
	else if (snow) {
		return `${percent} chance of ${snow} mm/h snow.`;
	}
	else {
		return `${percent} chance of precipitation.`;
	}
};
const formatSun = (report: Report, meta: WeatherFormatMeta) => {
	if (meta.hiddenLocation || report.kind !== "current" || !report.sun) {
		return "";
	}

	const nowSeconds = SupiDate.now() / 1000;
	const { rise, set } = report.sun;
	if (rise && nowSeconds < rise) {
		return `Sun rises ${core.Utils.timeDelta(rise * 1000)}.`;
	}
	else if (set && nowSeconds < set) {
		return `Sun sets ${core.Utils.timeDelta(set * 1000)}.`;
	}

	return "";
};
const formatReportTime = (report: WeatherReport) => {
	if (report.kind === "current") {
		return "(now)";
	}
	if (report.kind === "hourly") {
		return `(${report.time} local time)`;
	}

	return `(${report.date} local date)`;
};

const createWeatherFormatObject = (report: Report, meta: WeatherFormatMeta): WeatherFormatObject => ({
	place: meta.hiddenLocation ? "(location hidden)" : meta.place,
	icon: report.condition.icon ?? "",
	temperature: formatTemperature(report),
	cloudCover: formatCloudCover(report),
	humidity: formatHumidity(report),
	pressure: formatPressure(report),
	windSpeed: formatWindSpeed(report),
	windGusts: formatWindGusts(report),
	precipitation: formatPrecipitation(report),
	sun: formatSun(report, meta)
});

type WeatherFormatOptions = WeatherFormatMeta & { customFormat?: string | WeatherFormatKey[]; };
export const formatWeatherReport = (report: Report, options: WeatherFormatOptions): { formatted: string } => {
	const obj = createWeatherFormatObject(report, options);
	if (options.customFormat) {
		const keys = (typeof options.customFormat === "string")
			? options.customFormat.split(",").filter(Boolean)
			: options.customFormat;

		const reply = [];
		for (const key of keys) {
			if (!isWeatherFormatKey(key)) {
				reply.push(key);
				continue;
			}

			reply.push(obj[key]);
		}

		return {
			formatted: reply.filter(Boolean).join(" ")
		};
	}

	return {
		formatted: core.Utils.tag.trim `
			${obj.place} ${formatReportTime(report)}:
			${obj.icon}
			${obj.temperature}
			${obj.cloudCover}
			${obj.windSpeed} ${obj.windGusts}
			${obj.humidity}
			${obj.precipitation}
			${obj.pressure}
			${obj.sun}
		`
	} as const;
};
