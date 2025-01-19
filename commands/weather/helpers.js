// Sourced from: https://openweathermap.org/weather-conditions
const WEATHER_ICONS = {
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
	800: (current) => (current?.uvi === 0) ? "🌙" : "☀️", // Clear sky
	801: "🌤️", // Few clouds (11-25%)
	802: "🌥️", // Scattered clouds (25-50%)
	803: "☁️", // Broken clouds (51-84%)
	804: "☁️" // Overcast clouds (85-100%)
};
const WIND_DIRECTIONS = ["NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

export const getIcon = (code, current) => {
	const type = Math.trunc(code / 100);
	if (WEATHER_ICONS[type]) {
		return WEATHER_ICONS[type];
	}

	const iconData = WEATHER_ICONS[code];
	if (typeof iconData === "function") {
		return iconData(current);
	}
	else if (typeof iconData === "string") {
		return iconData;
	}
	else {
		return "";
	}
};

export const getWindDirection = (degrees) => {
	degrees %= 360;

	const base = 11.25;
	const interval = 22.5;
	if (degrees < base || degrees >= (360 - base)) {
		return "N";
	}

	const index = Math.trunc((degrees - base) / interval);

	return WIND_DIRECTIONS[index];
};
