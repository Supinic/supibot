import { promisify } from "node:util";
import { exec } from "node:child_process";

import type { Context, StrictResult } from "../../classes/command.js";
import type { User } from "../../classes/user.js";
import type { UserDataPropertyMap } from "../../classes/custom-data-properties.js";
import { fetchGeoLocationData } from "../../utils/command-utils.js";
import { get } from "../gpt/history-control.js";

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
type UserLocationResult =
	| { success: false; reason: "no-user"; }
	| { success: false; reason: "no-location"; userData: User; }
	| { success: true; location: NonNullable<UserDataPropertyMap["location"]>; userData: User };

const shell = promisify(exec);
const getGeoCacheKey = (query: string) => `weather-location-cache-${query.toLowerCase().trim()}`;

const getUserLocation = async (possibleUsername: string): Promise<UserLocationResult> => {
	const userData = await sb.User.get(possibleUsername);
	if (!userData) {
		return {
			success: false,
			reason: "no-user"
		};
	}

	const location = await userData.getDataProperty("location");
	if (!location) {
		return {
			success: false,
			reason: "no-location",
			userData
		};
	}

	return {
		success: true,
		location,
		userData
	};
};

export const getWeatherLocation = async (context: Context, args: readonly string[]): Promise<LocationResult> => {
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
	else if (sb.User.normalizeUsername(args[0]) === context.platform.selfName) {
		let temperature;
		try {
			const result = await shell("vcgencmd measure_temp");
			const temperatureMatch = result.stdout.match(/([\d.]+)/);
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
	else if (args[0].startsWith("@")) {
		const result = await getUserLocation(args[0]);
		if (!result.success) {
			if (result.reason === "no-user") {
				return {
					command: {
						success: false,
						reply: "Invalid user provided!"
					}
				};
			}
			else {
				const who = (result.userData.ID === context.user.ID) ? "You" : "That user";
				return {
					command: {
						success: false,
						reply: `${who} did not set their location!`
					}
				};
			}
		}

		const { location, userData } = result;
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
			// Check if the not-found location is actually someone's username - possibly as a user error
			const result = await getUserLocation(location);
			if (!result.success) {
				const emote = await context.getBestAvailableEmote(["peepoSadDank", "PepeHands", "FeelsBadMan"], "🙁");
				return {
					command: {
						success: false,
						reply: `That place was not found! ${emote}`
					}
				};
			}

			origin = (result.userData.ID === context.user.ID) ? "self" : "user";
			address = result.location.formatted;
			coords = result.location.coordinates;
		}
		else {
			origin = "public";
			address = geoData.formattedAddress;
			coords = geoData.coords;
		}
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
