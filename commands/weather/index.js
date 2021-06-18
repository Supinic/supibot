module.exports = {
	Name: "weather",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the current weather in a given location. You can specify parameters to check forecast, or mention a user to get their location, if they set it up. Check all possibilities in extended help. Weather data powered by Darksky.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		getIcon: (code) => {
			const type = Math.trunc(code / 100);
			const remainder = code % 100;

			if (type === 2) {
				return "⛈";
			}
			else if (type === 3) {
				return "🌧";
			}
			else if (type === 5) {
				return "🌧";
			}
			else if (type === 6) {
				return "🌨";
			}
			else if (type === 7) {
				if (remainder === 1 || remainder === 21 || remainder === 41) {
					return "🌫";
				}
				else if (remainder === 11) {
					return "🔥💨";
				}
				else if (remainder === 31 || remainder === 51 || remainder === 61) {
					return "🏜💨";
				}
				else if (remainder === 62) {
					return "🌋💨";
				}
				else if (remainder === 71 || remainder === 81) {
					return "🌪";
				}
			}
			else if (type === 8) {
				if (remainder === 0) {
					return "☀";
				}
				else {
					return "☁";
				}
			}

			return "";
		}
	})),
	Code: (async function weather (context, ...args) {
		let number = null;
		let type = "current";
		const weatherRegex = /\b(hour|day)\+(\d+)$/;
		const historyRegex = /-\s*\d/;

		if (args.length > 0) {
			if (historyRegex.test(args[args.length - 1])) {
				return {
					success: false,
					reply: "Checking for weather history is not currently implemented"
				};
			}
			else if (args && weatherRegex.test(args[args.length - 1])) {
				const match = args.pop().match(weatherRegex);
				if (!match[1] || !match[2]) {
					return {
						success: false,
						reply: `Invalid syntax of hour/day parameters!`
					};
				}

				number = Number(match[2]);
				if (match[1] === "day") {
					type = "daily";
				}
				else if (match[1] === "hour") {
					type = "hourly";
				}
				else {
					type = null;
				}

				if (!type || (type === "daily" && number > 7) || (type === "hourly" && number > 48)) {
					return {
						success: false,
						reply: "Invalid combination of parameters!"
					};
				}
			}
		}

		let skipLocation = false;
		let coords = null;
		let formattedAddress = null;

		if (args.length === 0) {
			if (context.user.Data.location) {
				skipLocation = context.user.Data.location.hidden;
				coords = context.user.Data.location.coordinates;
				formattedAddress = context.user.Data.location.formatted;
			}
			else {
				return {
					success: false,
					reply: `No place provided, and you don't have a default location set! You can use $set location (location) to set it, or add "private" to make it private 🙂`,
					cooldown: 2500
				};
			}
		}
		else if (args[0].toLowerCase().replace(/^@/, "") === "supibot") {
			const exec = require("child_process").execSync;
			const temperature = `${exec("/opt/vc/bin/vcgencmd measure_temp").toString().match(/([\d.]+)/)[1]}°C`;

			return {
				reply: `Supibot, Supinic's table, Raspberry Pi 3B: ${temperature}. No wind detected. No precipitation expected.`
			};
		}
		else if (args[0].startsWith("@")) {
			const userData = await sb.User.get(args[0]);
			if (!userData) {
				return {
					reply: "Invalid user provided!",
					cooldown: {
						length: 1000
					}
				};
			}
			else if (!userData.Data.location) {
				return {
					reply: "That user did not set their location!",
					cooldown: {
						length: 1000
					}
				};
			}
			else {
				coords = userData.Data.location.coordinates;
				skipLocation = userData.Data.location.hidden;
				formattedAddress = userData.Data.location.formatted;
			}
		}

		if (!coords) {
			if (args.length === 0) {
				return {
					reply: "No place provided!",
					cooldown: 2500
				};
			}

			const location = args.join(" ");
			const geoKey = {
				type: "coordinates",
				location
			};

			let geoData = await this.getCacheData(geoKey);
			if (!geoData) {
				const response = await sb.Got({
					url: "https://maps.googleapis.com/maps/api/geocode/json",
					responseType: "json",
					throwHttpErrors: false,
					searchParams: new sb.URLParams()
						.set("key", sb.Config.get("API_GOOGLE_GEOCODING"))
						.set("address", args.join(" "))
						.toString()
				});

				if (response.statusCode !== 200) {
					throw new sb.errors.APIError({
						statusCode: response.statusCode,
						apiName: "GoogleGeoAPI"
					});
				}

				if (!response.body.results[0]) {
					geoData = { empty: true };
				}
				else {
					const [result] = response.body.results;
					geoData = {
						empty: false,
						formattedAddress: result.formatted_address,
						coords: result.geometry.location
					};
				}

				await this.setCacheData(geoKey, geoData, { expiry: 7 * 864e5 });
			}

			if (geoData.empty) {
				const userCheck = await sb.User.get(args.join("_"));
				if (userCheck?.Data.location) {
					return {
						success: false,
						reply: `That place was not found! However, you probably meant to check that user's location - make sure to add the @ symbol before their name.`,
						cooldown: 5000
					};
				}

				const emote = await context.getBestAvailableEmote(["peepoSadDank", "PepeHands", "FeelsBadMan"], "🙁");
				return {
					success: false,
					reply: `That place was not found! ${emote}`
				};
			}

			formattedAddress = geoData.formattedAddress;
			coords = geoData.coords;
		}

		const { body: data } = await sb.Got("GenericAPI", {
			url: "https://api.openweathermap.org/data/2.5/onecall",
			responseType: "json",
			throwHttpErrors: false,
			searchParams: {
				lat: coords.lat,
				lon: coords.lng,
				units: "metric",
				appid: sb.Config.get("API_OPEN_WEATHER_MAP")
			}
		});

		let target;
		if (type === "current") {
			target = data.current;
		}
		else if (type === "hourly") {
			target = data.hourly[number];
		}
		else if (type === "daily") {
			target = data.daily[number];
		}

		let precip;
		if (type === "current") {
			if (target.rain && target.snow) {
				precip = `It is currently raining (${target.rain}mm/h) and snowing (${target.snow}mm/h).`;
			}
			else if (target.rain) {
				precip = `It is currently raining, ${target.rain}mm/h.`;
			}
			else if (target.snow) {
				precip = `It is currently snowing, ${target.snow}mm/h.`;
			}
			else {
				precip = "No precipitation right now.";
			}
		}
		else if (type === "hourly" || type === "daily") {
			if (target.pop === 0) {
				precip = "No precipitation expected.";
			}
			else {
				const percent = `${sb.Utils.round(target.pop * 100, 0)}%`;
				const rain = target.rain?.["1h"] ?? target.rain ?? null;
				const snow = target.snow?.["1h"] ?? target.snow ?? null;

				if (rain && snow) {
					precip = `${percent} chance of combined rain (${rain}mm/hr) and snow (${snow}mm/h).`;
				}
				else if (rain) {
					precip = `${percent} chance of ${rain}mm/h rain.`;
				}
				else if (snow) {
					precip = `${percent} chance of ${snow}mm/h snow.`;
				}
			}
		}

		let temperature;
		if (type === "current" || type === "hourly") {
			temperature = `${target.temp}°C, feels like ${target.feels_like}°C.`;
		}
		else if (type === "daily") {
			temperature = `${target.temp.min}°C to ${target.temp.max}°C.`;
		}

		const cloudCover = `Cloud cover: ${target.clouds}%.`;
		const windSpeed = (target.wind_speed)
			? `Wind speed: ${sb.Utils.round(target.wind_speed * 3.6)} km/h.`
			: "No wind.";
		const windGusts = (target.wind_gust)
			? `Wind gusts: up to ${sb.Utils.round(target.wind_gust * 3.6)} km/h.`
			: "No wind gusts.";
		const humidity = `Humidity: ${target.humidity}%.`;
		const pressure = `Air pressure: ${target.pressure} hPa.`;

		let weatherAlert = "";
		if (data.alerts && data.alerts.length !== 0) {
			if (skipLocation) {
				const tags = data.alerts.flatMap(i => i.tags ?? []);
				if (tags.length > 0) {
					const plural = (tags.length > 1) ? "s" : "";
					weatherAlert = `⚠ Weather alert${plural}: ${tags.join(", ")}.`;
				}
			}
			else {
				const alert = data.alerts.find(i => i.sender_name && (i.event || i.tags.length !== 0));
				if (alert) {
					weatherAlert = `⚠ Weather alert from ${alert.sender_name}: ${alert.event || alert.tags[0]}.`;
				}
			}
		}

		const icon = this.staticData.getIcon(target.weather[0].id);

		let plusTime;
		if (typeof number === "number") {
			const time = new sb.Date(target.dt * 1000).setTimezoneOffset(data.timezone_offset);
			if (type === "hourly") {
				plusTime = ` (${time.format("H:00")} local time)`;
			}
			else {
				plusTime = ` (${time.format("j.n.")} local date)`;
			}
		}
		else if (type === "current") {
			plusTime = " (now)";
		}

		const place = (skipLocation) ? "(location hidden)" : formattedAddress;
		return {
			reply: sb.Utils.tag.trim `
				${place} ${plusTime}:
				${icon}
				${temperature}
				${cloudCover}
				${windSpeed} ${windGusts}
				${humidity}
				${precip}
				${pressure}
				${weatherAlert}	
			`
		};
	}),
	Dynamic_Description: ((prefix) => [
		"Checks for current weather, or for hourly/daily forecast in a given location.",
		"If you, or a given user have set their location with the <code>set</code> command, this command supports that.",
		"",

		`<code>${prefix}weather (place)</code>`,
		"current weather in given location",
		"",

		`<code>${prefix}weather (place) <b>hour+X</b></code>`,
		"weather forecast in X hour(s) - accepts 1 through 48",
		"",

		`<code>${prefix}weather (place) <b>day+X</b></code>`,
		"weather forecast in X day(s) - accepts 1 through 7",
		"",

		"",
		"=".repeat(20),
		"",

		`<code>${prefix}weather</code>`,
		"If you set your own weather location, show its weather.",
		"",

		`<code>${prefix}weather @User</code>`,
		"If that user has set their own weather location, show its weather. The <code>@</code> symbol is mandatory.",
		"",

		`<code>${prefix}weather @User <b>(hour+X/day+X)</b></code>`,
		"Similar to above, shows the user's weather, but uses the hour/day specifier."
	])
};
