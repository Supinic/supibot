import cacheKeys from "../../utils/shared-cache-keys.json" with { type: "json" };
import { getConfig } from "../../config.js";

const { PLAYSOUNDS_ENABLED } = cacheKeys;
const {
	listenerAddress,
	listenerPort,
	playsoundListUrl = "(no address configured)"
} = getConfig().local ?? {};

const BASE_PLAYSOUND_CACHE_KEY = "playsound-cooldown";
const getPlaysoundCacheKey = (playsoundName) => `${BASE_PLAYSOUND_CACHE_KEY}-${playsoundName}`;

export default {
	Name: "playsound",
	Aliases: ["ps"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Plays a sound on Supinic's stream, if enabled. Use \"list\" as an argument to see the list of available playsounds.",
	Flags: ["developer","mention","pipe","whitelist"],
	Params: [],
	Whitelist_Response: `You can't use the command here, but here's a list of supported playsounds: ${playsoundListUrl}`,
	initialize: function () {
		if (!listenerAddress || !listenerPort) {
			console.warn("$playsound: Listener not configured - command will be unavailable");
			this.data.ttsEnabled = false;
		}
		else {
			this.data.ttsEnabled = true;
		}
	},
	Code: (async function playSound (context, playsound) {
		if (!this.data.ttsEnabled) {
			return {
				success: false,
				reply: `Local playsound listener is not configured!`
			};
		}

		const isConfigEnabled = await core.Cache.getByPrefix(PLAYSOUNDS_ENABLED);
		if (!isConfigEnabled) {
			return {
				reply: "Playsounds are currently disabled!"
			};
		}
		else if (!playsound || playsound === "list") {
			return {
				reply: `Currently available playsounds: ${playsoundListUrl}`
			};
		}

		if (playsound === "random") {
			playsound = await core.Query.getRecordset(rs => rs
				.select("Name")
				.from("data", "Playsound")
				.orderBy("RAND()")
				.limit(1)
				.single()
				.flat("Name")
			);
		}

		const data = await core.Query.getRecordset(rs => rs
			.select("*")
			.from("data", "Playsound")
			.where("Name = %s", playsound)
			.limit(1)
			.single()
		);

		if (!data) {
			return {
				reply: "That playsound either doesn't exist or is not available!",
				cooldown: 2500
			};
		}

		const cacheKey = getPlaysoundCacheKey(playsound);
		const existingCooldown = await core.Cache.getByPrefix(cacheKey) ?? 0;
		const now = sb.Date.now();

		if (existingCooldown >= now) {
			const delta = core.Utils.timeDelta(existingCooldown);
			return {
				reply: `The playsound's cooldown has not passed yet! Try again in ${delta}.`
			};
		}

		let success = null;
		try {
			const response = await core.Got.get("GenericAPI")({
				url: `${listenerAddress}:${listenerPort}/?audio=${data.Filename}`,
				responseType: "text"
			});

			success = (response.ok);
		}
		catch {
			await core.Cache.setByPrefix(PLAYSOUNDS_ENABLED, false);
			return {
				reply: "The desktop listener is not currently running! Turning off playsounds."
			};
		}

		await core.Query.getRecordUpdater(ru => ru
			.update("data", "Playsound")
			.set("Use_Count", data.Use_Count + 1)
			.where("Name = %s", data.Name)
		);

		const cooldownTimestamp = now + data.Cooldown;
		await core.Cache.setByPrefix(cacheKey, cooldownTimestamp, {
			expiry: data.Cooldown
		});

		return {
			success,
			reply: (success)
				? "Playsound has been played correctly on stream."
				: "An error occurred while playing the playsound!"
		};
	}),
	Dynamic_Description: null
};
