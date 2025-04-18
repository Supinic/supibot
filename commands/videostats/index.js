export default {
	Name: "videostats",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Post the statistics about a given bare video link (means, just the ID and not the entire link) in a given CyTube room.",
	Flags: ["mention","non-nullable","pipe","whitelist"],
	Params: null,
	Whitelist_Response: "Video statistics are only available in Cytube rooms.",
	Code: (async function videoStats (context, link) {
		if (!link) {
			return {
				success: false,
				reply: "No link provided!",
				cooldown: 2500
			};
		}

		const playedByData = await core.Query.getRecordset(rs => rs
			.select("COUNT(*) AS Count")
			.select("User_Alias.Name AS Name")
			.from("cytube", "Video_Request")
			.join("chat_data", "User_Alias")
			.where("Link = %s", link)
			.where("Channel = %n", context.channel.ID)
			.orderBy("COUNT(*) DESC")
			.groupBy("User_Alias")
		);
		if (playedByData.length === 0) {
			return {
				reply: "Provided link has no data associated with it!"
			};
		}

		const total = playedByData.reduce((acc, cur) => (acc + cur.Count), 0);
		const lastPlayedData = await core.Query.getRecordset(rs => rs
			.select("User_Alias.Name AS Name")
			.select("Posted")
			.from("cytube", "Video_Request")
			.join("chat_data", "User_Alias")
			.where("Link = %s", link)
			.where("Channel = %n", context.channel.ID)
			.orderBy("Video_Request.ID DESC")
			.limit(1)
			.single()
		);

		const top5 = [];
		for (let i = 0; i < 5; i++) {
			if (playedByData[i]) {
				top5.push(`${playedByData[i].Name}: ${playedByData[i].Count}x`);
			}
			else {
				break;
			}
		}

		return {
			reply: core.Utils.tag.trim `
				That video was queued ${total} times before.
				Mostly by: ${top5.join("; ")}.
				Last time it was queued ${core.Utils.timeDelta(lastPlayedData.Posted)},
				by ${lastPlayedData.Name}
			`
		};
	}),
	Dynamic_Description: null
};
