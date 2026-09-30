import { Owm3WeatherProvider, Owm4WeatherProvider } from "./owm.ts";
import { OpenMeteoProvider } from "./open-meteo.ts";

export const openMeteoWeatherProvider = new OpenMeteoProvider();

export const weatherProviders = {
	owm3: new Owm3WeatherProvider(),
	owm4: new Owm4WeatherProvider(),
	"open-meteo": openMeteoWeatherProvider
};
