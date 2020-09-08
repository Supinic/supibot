module.exports = {
	Name: "necrodancer",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 60000,
	Description: "Download an audio file to play with Crypt of the Necrodancer.",
	Flags: ["mention","pipe","whitelist"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function necrodancer (context, link) {
		if (!link) {
			return {
				reply: "Guidelines for Necrodancer songs here: https://pastebin.com/K4n151xz",
				cooldown: 2500
			};
		}
	
		let data = null;
		try {
			data = await sb.Utils.linkParser.fetchData(link);
		}
		catch {
			return { reply: "Link is not parsable!" };
		}
	
		const name = encodeURIComponent(data.name + " by " + context.user.Name);
		const url = `${sb.Config.get("LOCAL_IP")}:${sb.Config.get("LOCAL_PLAY_SOUNDS_PORT")}?necrodancer=${data.link}&name=${name}`;
		
		await context.channel.send("Downloading has started! Please wait...");
		await sb.Got(url);
	
		return { reply: "Downloaded successfully :)" };
	}),
	Dynamic_Description: null
};