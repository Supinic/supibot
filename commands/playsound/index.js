const BASE_CACHE_KEY = `playsound-cooldown`;
const getCacheKey = (playsoundName) => `${BASE_CACHE_KEY}-${playsoundName}`;
const tts = {
	enabled: null,
	url: null
};

module.exports = {
	Name: "playsound",
	Aliases: ["ps"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Plays a sound on Supinic's stream, if enabled. Use \"list\" as an argument to see the list of available playsounds.",
	Flags: ["developer","mention","pipe","whitelist"],
	Params: null,
	Whitelist_Response: "You can't use the command here, but here's a list of supported playsounds: https://supinic.com/stream/playsound/list",
	initialize: function () {
		if (!sb.Config.has("LOCAL_IP", true) || !sb.Config.has("LOCAL_PLAY_SOUNDS_PORT", true)) {
			console.warn("$ps: Listener not configured - will be unavailable");
			tts.enabled = false;
		}
		else {
			tts.url = `${sb.Config.get("LOCAL_IP")}:${sb.Config.get("LOCAL_PLAY_SOUNDS_PORT")}`;
			tts.enabled = true;
		}
	},
	Code: (async function playSound (context, playsound) {
		if (!tts.enabled) {
			return {
				success: false,
				reply: `Local playsound listener is not configured!`
			};
		}
		else if (!sb.Config.get("PLAYSOUNDS_ENABLED")) {
			return {
				reply: "Playsounds are currently disabled!"
			};
		}
		else if (!playsound || playsound === "list") {
			return {
				reply: "Currently available playsounds: https://supinic.com/stream/playsound/list"
			};
		}

		if (playsound === "random") {
			playsound = await sb.Query.getRecordset(rs => rs
				.select("Name")
				.from("data", "Playsound")
				.orderBy("RAND()")
				.limit(1)
				.single()
				.flat("Name")
			);
		}

		const data = await sb.Query.getRecordset(rs => rs
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

		const cacheKey = getCacheKey(playsound);
		const existingCooldown = await sb.Cache.getByPrefix(cacheKey) ?? 0;
		const now = sb.Date.now();

		if (existingCooldown >= now) {
			const delta = sb.Utils.timeDelta(existingCooldown);
			return {
				reply: `The playsound's cooldown has not passed yet! Try again in ${delta}.`
			};
		}

		let success = null;
		try {
			const response = await sb.Got("GenericAPI", {
				url: `${tts.url}/?audio=${data.Filename}`,
				responseType: "text"
			});

			success = (response.ok);
		}
		catch (e) {
			await sb.Config.set("PLAYSOUNDS_ENABLED", false);

			return {
				reply: "The desktop listener is not currently running, turning off playsounds!"
			};
		}

		await sb.Query.getRecordUpdater(ru => ru
			.update("data", "Playsound")
			.set("Use_Count", data.Use_Count + 1)
			.where("Name = %s", data.Name)
		);

		const cooldownTimestamp = now + data.Cooldown;
		await sb.Cache.setByPrefix(cacheKey, cooldownTimestamp, {
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
