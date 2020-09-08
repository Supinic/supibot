module.exports = {
	Name: "randomzizarandeath",
	Aliases: ["rzd"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 30000,
	Description: "Posts a random video with Zizaran dying in Path of Exile.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: ({
		playlist: "PLbpExg9_Xax24tS9rNt8IP49VFFaDghAG"
	}),
	Code: (async function randomZizaranDeath () {
		if (!this.data.videoList) {
			const { result, reason, success } = await sb.Utils.fetchYoutubePlaylist({
				key: sb.Config.get("API_GOOGLE_YOUTUBE"),
	   			playlistID: this.staticData.playlist
			});
	
			if (!success) {
				return {
					success,
					reply: `Playlist could not be fetched! Reason: ${reason}`
				};
			}
			else {
				this.data.videoList = result;
			}
		}
	
		const video = sb.Utils.randArray(this.data.videoList);
		return {
			reply: `PepeLaugh 👉 https://youtu.be/${video.ID}`
		};
	}),
	Dynamic_Description: null
};