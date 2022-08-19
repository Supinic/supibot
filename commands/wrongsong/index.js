module.exports = {
	Name: "wrongsong",
	Aliases: ["ws"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "If you have at least one song playing or in the queue, this command will skip the first one. You can also add an ID to skip a specific song.",
	Flags: ["mention","pipe","whitelist"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function wrongSong (context, target) {
		let targetID;
		if (target) {
			targetID = Number(target);
			if (!sb.Utils.isValidInteger(targetID)) {
				return {
					success: false,
					reply: `Could not parse your provided song ID!`
				};
			}
		}
		
		const userRequest = await sb.Query.getRecordset(rs => rs
			.select("Song_Request.ID", "Name", "VLC_ID", "Status")
			.select("Video_Type.Link_Prefix AS Prefix")
			.from("chat_data", "Song_Request")
			.join({
				toDatabase: "data",
				toTable: "Video_Type",
				on: "Video_Type.ID = Song_Request.Video_Type"
			})
			.where({ condition: Boolean(targetID) }, "Song_Request.VLC_ID = %n", targetID)
			.where("User_Alias = %n", context.user.ID)
			.where("Status IN %s+", ["Current", "Queued"])
			.orderBy("Song_Request.ID DESC")
			.limit(1)
			.single()
		);
	
		if (!userRequest) {
			return {
				reply: (target)
					? "Target video ID was not found, or it wasn't requested by you!"
					: "You don't currently have any videos in the playlist!"
			};
		}
	
		let action = "";
		if (userRequest.Status === "Current") {
			const requestsAhead = await sb.Query.getRecordset(rs => rs
				.select("COUNT(*) AS Amount")
				.from("chat_data", "Song_Request")
				.where("Status = %s", "Queued")
				.where("ID > %n", userRequest.ID)
				.limit(1)
				.single()
			);
	
			if (requestsAhead.Amount > 0) {
				action = "skipped";
				await sb.VideoLANConnector.client.playlistNext();
			}
			else {
				action = "skipped, and the playlist stopped";
				await sb.VideoLANConnector.actions.stop();
			}
		}
		else if (userRequest.Status === "Queued") {
			action = "deleted from the playlist";
			await sb.VideoLANConnector.client.playlistDelete(userRequest.VLC_ID);
		}
	
		return {
			reply: `Your request "${userRequest.Name}" (ID ${userRequest.VLC_ID}) has been successfully ${action}.`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Skips your current or queued song.",
		"Can add an ID to skip/delete a specific song in the queue, queued by you only.",
		"",
	
		`<code>${prefix}ws</code>`,
		"Skips the earliest request you have playing or in the queue.",
		"",
	
		`<code>${prefix}ws (ID)</code>`,
		"Skips your request with given ID. Fails if it's not your request."
	])
};
