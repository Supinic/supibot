module.exports = {
	Name: "when",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Tells you when your command is going to be played next, approximately.",
	Flags: ["mention","pipe","whitelist"],
	Params: null,
	Whitelist_Response: "Only available in channels with VLC API configured!",
	Static_Data: null,
	Code: (async function when (context) {
		if (sb.Config.get("SONG_REQUESTS_STATE") !== "vlc") {
			return {
				reply: "Song requests are currently off or not in VLC!"
			};
		}
	
		const queue = await sb.VideoLANConnector.getNormalizedPlaylist();
		const personal = queue.filter(i => i.User_Alias === context.user.ID);
	
		if (queue.length === 0) {
			return {
				reply: "The playlist is currently empty."
			};
		}
		else if (personal.length === 0) {
			return {
				reply: "You have no video(s) queued up."
			};
		}
	
		let prepend = "";
		let target = personal[0];
		let timeRemaining = 0;
	
		if (target.Status === "Current") {
			if (personal.length === 1) {
				return {
					reply: `Your request "${target.Name}" is playing right now. You don't have any other videos in the queue.`
				};
			}
			else {
				prepend = `Your request "${target.Name}" is playing right now.`;
				target = personal[1];
			}
		}
	
		let index = 0;
		let loopItem = queue[index];
		while (loopItem !== target && index < queue.length) {
			timeRemaining += loopItem.Duration;
			loopItem = queue[++index];
		}
	
		const status = await sb.VideoLANConnector.status();
		const current = queue.find(i => i.Status === "Current");
		if (status) {
			const endTime = current.End_Time ?? status.time;
			timeRemaining -= endTime;
		}
	
		const delta = sb.Utils.formatTime(Math.round(timeRemaining));
		const bridge = (prepend) ? "Then," : "Your next video";
		const pauseString = (sb.Config.get("SONG_REQUESTS_VLC_PAUSED"))
			? "Song requests are paused at the moment."
			: "";
	
		return {
			reply: `${prepend} ${bridge} "${target.Name}" is playing in ${delta}. ${pauseString}`
		};
	}),
	Dynamic_Description: null
};