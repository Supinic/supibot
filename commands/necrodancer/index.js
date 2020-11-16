module.exports = {
	Name: "necrodancer",
	Aliases: null,
	Author: "supinic",
	Cooldown: 60000,
	Description: "Download an audio file to play with Crypt of the Necrodancer.",
	Flags: ["mention","pipe","whitelist"],
	Whitelist_Response: null,
	Static_Data: (() => ({
		zones: [
			"lobby",
			"1-1", "1-2", "1-3",
			"2-1", "2-2", "2-3",
			"3-1", "3-2", "3-3",
			"4-1", "4-2", "4-3",
			"5-1", "5-2", "5-3",
			"conga", "chess", "bass", "metal", "mole"
		]
	})),
	Code: (async function necrodancer (context, link, zone) {
		if (context.channel?.ID !== 38) {
			return {
				success: false,
				reply: "This shouldn't happen, but the command cannot be used here!"
			};
		}

		const { zones } = this.staticData;
		if (!link) {
			return {
				reply: "Check the basic guidelines for Necrodancer songs here: https://pastebin.com/K4n151xz TL;DR - not too fast, not too slow, not too short." ,
				cooldown: 2500
			};
		}
		else if (!zone) {
			return {
				success: false,
				reply: "No game zone provided! Use one of: " + zones.join(", "),
				cooldown: 2500
			};
		}

		zone = zone.toLowerCase();
		if (!zones.includes(zone)) {
			return {
				success: false,
				reply: "Invalid zone provided! Use one of: " + zones.join(", ")
			};
		}

		const data = JSON.stringify({ link, zone });
		const url = `${sb.Config.get("LOCAL_IP")}:${sb.Config.get("LOCAL_PLAY_SOUNDS_PORT")}?necrodancer=${data}`;
		
		await context.channel.send("Download + beat mapping + saving started! Please wait...");
		await sb.Got(url);
	
		return {
			reply: "Downloaded + beat mapped successfully! AlienPls"
		};
	}),
	Dynamic_Description: null
};