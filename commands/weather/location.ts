import { promisify } from "node:util";
import { exec } from "node:child_process";

import type { Context, StrictResult } from "../../classes/command.js";
import { fetchGeoLocationData } from "../../utils/command-utils.js";

const shell = promisify(exec);

type GeoCacheData = { empty: true } | {
	empty: false;
	formattedAddress: string;
	coords: { lat: number; lng: number; };
};

type WeatherLocation = {
	location: {
		coords: { lat: number; lng: number };
		hidden: boolean;
		address: string;
		origin: "self" | "user" | "public";
	};
};
type CommandResult = { command: StrictResult };
type LocationResult = CommandResult | WeatherLocation;

const getGeoCacheKey = (query: string) => `weather-location-cache-${query.toLowerCase().trim()}`;

export const getWeatherLocation = async (context: Context, args: string[]): Promise<LocationResult> => {
	let origin: "self" | "user" | "public";
	let hidden = false;
	let coords: { lat: number; lng: number };
	let address: string;

	if (args.length === 0) {
		const location = await context.user.getDataProperty("location");
		if (!location) {
			return {
				command: {
					success: false,
					reply: `No place provided, and you don't have a default location set! You can use $set location (location) to set it, or add "private" to make it private 🙂`
				}
			};
		}

		origin = "self";
		hidden = location.hidden;
		coords = location.coordinates;
		address = location.formatted;
	}
	else if (args[0].startsWith("@")) {
		const userData = await sb.User.get(args[0]);
		if (!userData) {
			return {
				command: {
					success: false,
					reply: "Invalid user provided!"
				}
			};
		}

		if (userData.Name === context.platform.selfName) {
			let temperature;
			try {
				const result = await shell("vcgencmd measure_temp");
				const temperatureMatch = result.stdout.toString().match(/([\d.]+)/);
				if (temperatureMatch) {
					temperature = `${temperatureMatch[1]}°C`;
				}
			}
			catch (e) {
				console.warn(e);
			}

			return {
				command: {
					success: true,
					reply: `Supibot, Supinic's LACK table: ${temperature ?? "Unknown temperature"}. No wind detected. No precipitation expected.`
				}
			};
		}

		const location = await userData.getDataProperty("location");
		if (!location) {
			const who = (userData.ID === context.user.ID) ? "You" : "That user";
			return {
				command: {
					success: false,
					reply: `${who} did not set their location!`
				}
			};
		}

		origin = (userData.ID === context.user.ID) ? "self" : "user";
		coords = location.coordinates;
		hidden = location.hidden;
		address = location.formatted;
	}
	else {
		const location = args.join(" ");
		const cacheKey = getGeoCacheKey(location);

		let geoData = await core.Cache.getByPrefix(cacheKey) as GeoCacheData | undefined;
		if (!geoData) {
			const data = await fetchGeoLocationData(location);
			if (!data.success) { // only happens on zero results, API failure causes a request error
				geoData = { empty: true };
			}
			else {
				geoData = {
					empty: false,
					formattedAddress: data.formatted,
					coords: data.location
				};
			}

			await core.Cache.setByPrefix(cacheKey, geoData, { expiry: 7 * 864e5 });
		}

		if (geoData.empty) {
			// Check if the not-found location is actually someone's username - possibly hinting at a user error
			const checkUserData = await sb.User.get(location);
			const checkLocation = await checkUserData?.getDataProperty("location");
			if (checkLocation) {
				return {
					command: {
						success: false,
						reply: `That place was not found! However, you probably meant to check @${location}'s location. Use "$weather @${location}" instead, with the @ symbol.`,
						cooldown: 5000
					}
				};
			}

			const emote = await context.getBestAvailableEmote(["peepoSadDank", "PepeHands", "FeelsBadMan"], "🙁");
			return {
				command: {
					success: false,
					reply: `That place was not found! ${emote}`
				}
			};
		}

		origin = "public";
		address = geoData.formattedAddress;
		coords = geoData.coords;
	}

	return {
		location: {
			origin,
			coords,
			hidden,
			address: (hidden) ? "(location hidden)" : address
		}
	};
};
