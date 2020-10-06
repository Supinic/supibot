module.exports = {
	Name: "playsound",
	Aliases: ["ps"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Plays a sound on supinic stream, if enabled. Use \"list\" as an argument to see the list of available playsounds.",
	Flags: ["mention","pipe","whitelist"],
	Whitelist_Response: null,
	Static_Data: (() => {
		this.data.cooldowns = {};	
	
		return {
			fetch: (name) => sb.Query.getRecordset(rs => rs
				.select("*")
				.from("data", "Playsound")
				.where("Name = %s", name)
				.limit(1)
				.single()
			)
		};
	}),
	Code: (async function playSound (context, playsound) {
		if (!sb.Config.get("PLAYSOUNDS_ENABLED")) {
			return { reply: "Playsounds are currently disabled!" };
		}
		else if (!playsound || playsound === "list") {
			return { reply: "Currently available playsounds: https://supinic.com/stream/playsound/list"};
		}
	
		const data = await this.staticData.fetch(playsound);
		if (!data) {
			return {
				reply: "That playsound either doesn't exist or is not available!",
				cooldown: 2500
			};
		}
	
		this.data.cooldowns[data.Name] = this.data.cooldowns[data.Name] ?? 0;
	
		const now = sb.Date.now();
		if (this.data.cooldowns[data.Name] >= now) {
			const delta = sb.Utils.timeDelta(this.data.cooldowns[data.Name]);
			return {
				reply: `The playsound's cooldown has not passed yet! Try again in ${delta}.`
			};
		}
	
		let success = null;
		try {
			success = await sb.LocalRequest.playAudio(data.Filename);
		}
		catch (e) {
			console.warn(e);
			await sb.Config.set("PLAYSOUNDS_ENABLED", false);
			return { reply: "The desktop listener is not currently running, turning off playsounds!" }
		}
	
		await sb.Query.getRecordUpdater(ru => ru
			.update("data", "Playsound")
			.set("Use_Count", data.Use_Count + 1)
			.where("Name = %s", data.Name)
		);
	
		this.data.cooldowns[data.Name] = now + data.Cooldown;
		return {
			success,
			reply: (success)
				? "Playsound has been played correctly on stream."
				: "An error occured while playing the playsound!"
		};
	}),
	Dynamic_Description: null
};