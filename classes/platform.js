module.exports = class Platform extends require("./template.js") {
	#controller = null;
	#userMessagePromises = new Map();
	static uniqueIdentifier = "Name";

	fetchInternalPlatformIDByUsername (userData) {
		if (this.Name === "twitch") {
			return userData.Twitch_ID;
		}
	}

	async fetchUsernameByUserPlatformID (userPlatformID) {
		if (this.Name === "twitch") {
			const response = await sb.Got("Helix", {
				url: "users",
				throwHttpErrors: false,
				searchParams: {
					id: userPlatformID
				}
			});

			if (!response.ok || response.body.data.length === 0) {
				return null;
			}

			return response.body.data[0].login;
		}
	}
};
