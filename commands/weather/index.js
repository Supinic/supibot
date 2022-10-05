module.exports = {
	Name: "weather",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the current weather in a given location. You can specify parameters to check forecast, or mention a user to get their location, if they set it up. Check all possibilities in extended help.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "alerts", type: "boolean" },
		{ name: "format", type: "string" },
		{ name: "latitude", type: "number" },
		{ name: "longitude", type: "number" },
		{ name: "pollution", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		allowedTypes: ["cloudCover", "humidity", "icon", "place", "precipitation", "pressure", "sun", "temperature", "windGusts", "windSpeed"],
		getIcon: (code, current) => {
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
					return (current.uvi === 0) ? "🌙" : "☀";
				}
				else if (remainder === 1) {
					return "🌤️";
				}
				else if (remainder === 2) {
					return "🌥";
				}
				else {
					return "️☁";
				}
			}

			return "";
		},
		getWindDirection: (degrees) => {
			degrees %= 360;

			const base = 11.25;
			const interval = 22.5;
			if (degrees < base || degrees >= (360 - base)) {
				return "N";
			}

			const directions = ["NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
			const index = Math.trunc((degrees - base) / interval);

			return directions[index];
		},
		pollutionIndexIcons: {
			1: "🔵",
			2: "🟢",
			3: "🟡",
			4: "🟠",
			5: "🔴"
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
					return {
						success: false,
						reply: "Invalid combination of parameters! Use day+# or hour+#"
					};
				}
			}
		}

		let skipLocation = false;
		let coords = null;
		let formattedAddress = null;
		let isOwnLocation = null;

		if (typeof context.params.latitude === "number" || typeof context.params.longitude === "number") {
			const { latitude, longitude } = context.params;
			if (typeof latitude !== "number" || typeof longitude !== "number") {
				return {
					success: false,
					reply: `If using exact coordinates, you must specify both the latitude and the longitude!`
				};
			}

			if (latitude > 90 || latitude < -90) {
				return {
					success: false,
					reply: `Invalid latitude! Must be in range <-90, 90>`
				};
			}
			else if (longitude < -180 || longitude > 180) {
				return {
					success: false,
					reply: `Invalid longitude! Must be in range <-180, 180>`
				};
			}

			coords = {
				lat: latitude,
				lng: longitude
			};
		}
		else if (args.length === 0) {
			isOwnLocation = true;

			const location = await context.user.getDataProperty("location");
			if (location) {
				skipLocation = location.hidden;
				coords = location.coordinates;
				formattedAddress = location.formatted;
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
			isOwnLocation = (userData === context.user);

			if (!userData) {
				return {
					reply: "Invalid user provided!",
					cooldown: {
						length: 1000
					}
				};
			}

			const location = await userData.getDataProperty("location");
			if (!location) {
				return {
					reply: "That user did not set their location!",
					cooldown: {
						length: 1000
					}
				};
			}
			else {
				coords = location.coordinates;
				skipLocation = location.hidden;
				formattedAddress = location.formatted;
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
				const response = await sb.Got("GenericAPI", {
					url: "https://maps.googleapis.com/maps/api/geocode/json",
					responseType: "json",
					throwHttpErrors: false,
					searchParams: {
						key: sb.Config.get("API_GOOGLE_GEOCODING"),
						address: args.join(" ")
					}
				});

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
				// Check if the location is actually someone's username
				const checkUserData = await sb.User.get(location);
				const checkLocation = await checkUserData?.getDataProperty("location");

				if (checkLocation) {
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

		if (context.params.pollution) {
			const response = await sb.Got("GenericAPI", {
				url: "https://api.openweathermap.org/data/2.5/air_pollution",
				responseType: "json",
				throwHttpErrors: false,
				timeout: {
					request: 60_000
				},
				searchParams: {
					lat: coords.lat,
					lon: coords.lng,
					appid: sb.Config.get("API_OPEN_WEATHER_MAP")
				}
			});

			const [data] = response.body.list;
			const index = data.main.aqi;
			const { components } = data;
			const place = (skipLocation) ? "(location hidden)" : formattedAddress;

			const { pollutionIndexIcons } = this.staticData;
			const icon = pollutionIndexIcons[index];

			const componentsString = Object.entries(components)
				.map(([type, value]) => `${type.toUpperCase().replace("_", ".")}: ${value.toFixed(3)}`)
				.join(", ");

			return {
				reply: sb.Utils.tag.trim `
					${place} current pollution index: ${index} ${icon}
					Particles: ${componentsString}.				
				`
			};
		}

		const weatherKey = { type: "weather", coords: `${coords.lat}-${coords.lng}` };
		let data = await this.getCacheData(weatherKey);
		if (!data) {
			const response = await sb.Got("GenericAPI", {
				url: "https://api.openweathermap.org/data/2.5/onecall",
				responseType: "json",
				throwHttpErrors: false,
				timeout: {
					request: 60_000
				},
				searchParams: {
					lat: coords.lat,
					lon: coords.lng,
					units: "metric",
					appid: sb.Config.get("API_OPEN_WEATHER_MAP")
				}
			});

			if (response.statusCode === 429) {
				return {
					success: false,
					reply: `The weather API is currently unavailable due to too many requests! Try again later.`
				};
			}

			data = response.body;
			await this.setCacheData(weatherKey, data, {
				expiry: 30 * 60_000 // 30 minutes cache
			});
		}

		if (context.params.alerts) {
			if (!data.alerts || data.alerts.length === 0) {
				return {
					reply: sb.Utils.tag.trim `
						Weather alert summary for
						${(skipLocation) ? "(location hidden)" : formattedAddress}
						-
						no alerts.
					 `
				};
			}

			const pastebinKey = { type: "pastebin", coords: `${coords.lat}-${coords.lng}` };
			let pastebinLink = await this.getCacheData(pastebinKey);
			if (!pastebinLink) {
				const text = data.alerts.map(i => {
					const start = new sb.Date(i.start * 1000).setTimezoneOffset(data.timezone_offset / 60);
					const end = new sb.Date(i.end * 1000).setTimezoneOffset(data.timezone_offset / 60);
					const tags = (!i.tags || i.tags.length === 0)
						? ""
						: `-- ${i.tags.sort().join(", ")}`;

					return [
						`Weather alert from ${i.sender_name ?? ("(unknown source)")} ${tags}`,
						i.event ?? "(no event specified)",
						`Active between: ${start.format("Y-m-d H:i")} and ${end.format("Y-m-d H:i")} local time`,
						`${i.description ?? "(no description)"}`
					].join("\n");
				}).join("\n\n");

				const response = await sb.Pastebin.post(text, {
					name: (skipLocation)
						? `Weather alerts - private location`
						: `Weather alerts - ${formattedAddress}`,
					expiration: "1H"
				});

				pastebinLink = response.body;
				await this.setCacheData(pastebinKey, pastebinLink, { expiry: 3_600_000 });
			}

			if (skipLocation) {
				if (isOwnLocation) {
					await context.platform.pm(
						`Your location's weather alerts: ${pastebinLink}`,
						context.user.Name,
						context.channel
					);

					return {
						reply: sb.Utils.tag.trim `
							Weather alert summary for your hidden location: ${data.alerts.length} alerts.
							I sent you a private message with the link to the full description.
						`
					};
				}
				else {
					return {
						reply: `Weather alert summary for their hidden location: ${data.alerts.length} alerts.`
					};
				}
			}
			else {
				return {
					reply: sb.Utils.tag.trim `
						Weather alert summary for
						${(skipLocation) ? "(location hidden)" : formattedAddress}
						- 
						${data.alerts.length} alerts 
						-
						full info: ${pastebinLink}
					`
				};
			}
		}

		let target;
		if (type === "current") {
			target = data.current;
		}
		else if (type === "hourly") {
			target = data.hourly[number];

			if (!target) {
				return {
					success: false,
					reply: `Invalid hour offset provided! Use a number between 0 and ${data.hourly.length - 1}.`
				};
			}
		}
		else if (type === "daily") {
			target = data.daily[number];

			if (!target) {
				return {
					success: false,
					reply: `Invalid day offset provided! Use a number between 0 and ${data.daily.length - 1}.`
				};
			}
		}

		const { getIcon, getWindDirection } = this.staticData;
		const obj = {
			place: (skipLocation) ? "(location hidden)" : formattedAddress,
			icon: getIcon(target.weather[0].id, data.current),
			cloudCover: `Cloud cover: ${target.clouds}%.`,
			humidity: `Humidity: ${target.humidity}%.`,
			pressure: `Air pressure: ${target.pressure} hPa.`,
			windSpeed: (target.wind_speed)
				? `${getWindDirection(target.wind_deg)} wind speed: ${target.wind_speed} m/s.`
				: "No wind.",
			windGusts: (target.wind_gust)
				? `Wind gusts: up to ${target.wind_gust} m/s.`
				: "No wind gusts.",
			sun: ""
		};

		if (type === "current") {
			const rain = target.rain?.["1h"] ?? target.rain ?? null;
			const snow = target.snow?.["1h"] ?? target.snow ?? null;

			if (rain && snow) {
				obj.precipitation = `It is currently raining (${rain}mm/h) and snowing (${snow}mm/h).`;
			}
			else if (rain) {
				obj.precipitation = `It is currently raining, ${rain}mm/h.`;
			}
			else if (snow) {
				obj.precipitation = `It is currently snowing, ${snow}mm/h.`;
			}
			else {
				const start = new sb.Date().discardTimeUnits("s", "ms");
				for (const { dt, precipitation: pr } of (data.minutely ?? [])) {
					if (pr !== 0) {
						const when = new sb.Date(dt * 1000).discardTimeUnits("s", "ms");
						const minuteIndex = Math.trunc(when - start) / 60_000;
						if (minuteIndex < 1) {
							obj.precipitation = "Precipitation expected in less than a minute!";
						}
						else {
							const plural = (minuteIndex === 1) ? "" : "s";
							obj.precipitation = `Precipitation expected in ~${minuteIndex} minute${plural}.`;
						}

						break;
					}
				}

				obj.precipitation ??= "No precipitation right now.";
			}
		}
		else if (type === "hourly" || type === "daily") {
			if (target.pop === 0) {
				obj.precipitation = "No precipitation expected.";
			}
			else {
				const percent = `${sb.Utils.round(target.pop * 100, 0)}%`;
				const rain = target.rain?.["1h"] ?? target.rain ?? null;
				const snow = target.snow?.["1h"] ?? target.snow ?? null;

				if (rain && snow) {
					obj.precipitation = `${percent} chance of combined rain (${rain}mm/hr) and snow (${snow}mm/h).`;
				}
				else if (rain) {
					obj.precipitation = `${percent} chance of ${rain}mm/h rain.`;
				}
				else if (snow) {
					obj.precipitation = `${percent} chance of ${snow}mm/h snow.`;
				}
				else {
					obj.precipitation = `${percent} chance of precipitation.`;
				}
			}
		}

		if (type === "current" || type === "hourly") {
			obj.temperature = `${target.temp}°C, feels like ${target.feels_like}°C.`;
		}
		else if (type === "daily") {
			obj.temperature = `${target.temp.min}°C to ${target.temp.max}°C.`;
		}

		if (type === "current" && !skipLocation) {
			const nowSeconds = sb.Date.now() / 1000;
			let verb;
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

			if (sunTime !== 0) {
				obj.sun = `Sun ${verb}s ${sb.Utils.timeDelta(sunTime * 1000)}.`;
			}
			else {
				// Determine if the Sun is down or up based on UV index
				verb = (data.current.uvi === 0) ? "rise" : "set";
				const property = `sun${verb}`;

				let time;
				for (const day of data.daily) {
					if (day[property]) {
						time = day[property];
						break;
					}
				}

				if (time) {
					obj.sun = `Sun ${verb}s ${sb.Utils.timeDelta(time * 1000)}.`;
				}
				else {
					obj.sun = `Sun does not ${verb} in the next 7 days.`;
				}
			}
		}

		let weatherAlert = "";
		if (data.alerts && data.alerts.length !== 0) {
			const targetTime = new sb.Date();
			if (type === "hourly") {
				targetTime.addHours(number);
			}
			else if (type === "daily") {
				targetTime.addDays(number);
			}

			const relevantAlerts = data.alerts.filter(i => {
				const start = new sb.Date(i.start * 1000);
				const end = new sb.Date(i.end * 1000);

				return (start <= targetTime && end >= targetTime);
			});

			const tagList = relevantAlerts.flatMap(i => i.tags ?? []).sort();
			const tags = [...new Set(tagList)];

			if (tags.length > 0) {
				const plural = (tags.length > 1) ? "s" : "";
				weatherAlert = `⚠ Weather alert${plural}: ${tags.join(", ")}.`;
			}
		}

		let plusTime;
		if (typeof number === "number") {
			const time = new sb.Date(target.dt * 1000).setTimezoneOffset(data.timezone_offset / 60);
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

		if (context.params.format) {
			const format = new Set(context.params.format.split(/\W/).filter(Boolean));
			const reply = [];

			for (const element of format) {
				if (typeof obj[element] === "undefined") {
					return {
						success: false,
						reply: `Cannot create custom weather format with the "${element}" element!`
					};
				}

				reply.push(obj[element]);
			}

			return {
				reply: reply.join(" ")
			};
		}
		else {
			return {
				reply: sb.Utils.tag.trim `
					${obj.place} ${plusTime}:
					${obj.icon}
					${obj.temperature}
					${obj.cloudCover}
					${obj.windSpeed} ${obj.windGusts}
					${obj.humidity}
					${obj.precipitation}
					${obj.pressure}
					${obj.sun}
					${weatherAlert}
				`
			};
		}
	}),
	Dynamic_Description: ((prefix) => {
		const { allowedTypes } = this.staticData;

		return [
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

			`<code>${prefix}weather (place) alerts:true</code>`,
			"Posts a summary of all weather alerts for the provided location - for the next 7 days.",
			"",

			`<code>${prefix}weather (place) pollution:true</code>`,
			"Posts a summary of the current pollution for the provided location.",
			"",

			`<code>${prefix}weather (place) format:(custom format)</code>`,
			`<code>${prefix}weather (place) format:temperature</code>`,
			`<code>${prefix}weather (place) format:temperature,humidity,pressure</code>`,
			"Lets you choose specific weather elements to show in the result.",
			`Supported elements: <code>${allowedTypes.join(", ")}</code>`,
			"",

			`<code>${prefix}weather latitude:(number) longitude:(number)</code>`,
			`<code>${prefix}weather latitude:0.2998175 longitude:32.5394548</code>`,
			"Allows you to query a location to find weather in by GPS coordinates precisely.",
			"",

			"",
			"=".repeat(20),
			"",

			`<code>${prefix}weather</code>`,
			"If you set your own weather location, show its weather.",
			"",

			`<code>${prefix}weather alerts:true</code>`,
			"Posts a summary of all weather alerts for your location - for the next 7 days, if you have set it up.",
			"",

			`<code>${prefix}weather @User</code>`,
			"If that user has set their own weather location, show its weather. The <code>@</code> symbol is mandatory.",
			"",

			`<code>${prefix}weather @User <b>(hour+X/day+X)</b></code>`,
			"Similar to above, shows the user's weather, but uses the hour/day specifier.",
			"",

			`<code>${prefix}weather @User alerts:true</code>`,
			"Posts a summary of all weather alerts for the user's location - for the next 7 days.",
			"",

			`<code>${prefix}weather pollution:true</code>`,
			`<code>${prefix}weather @User pollution:true</code>`,
			"Posts a summary of the current pollution for your or the provided user's location."
		];
	})
};
