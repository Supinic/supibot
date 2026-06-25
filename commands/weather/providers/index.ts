import { Owm3WeatherProvider, Owm4WeatherProvider } from "./owm.js";

export const weatherProviders = {
	owm3: new Owm3WeatherProvider(),
	owm4: new Owm4WeatherProvider()
};
