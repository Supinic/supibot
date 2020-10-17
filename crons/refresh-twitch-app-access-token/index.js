module.exports = {
	Name: "refresh-twitch-app-access-token",
	Expression: "0 0 12 * * *",
	Defer: null,
	Type: "Bot",
	Code: (async function refreshTwitchAppAccessToken () {
		const { access_token: token } = await sb.Got({
			method: "POST",
			url: "https://id.twitch.tv/oauth2/token",
			responseType: "json",
			searchParams: new sb.URLParams()
				.set("grant_type", "client_credentials")
				.set("client_id", sb.Config.get("TWITCH_CLIENT_ID"))
				.set("client_secret", sb.Config.get("TWITCH_CLIENT_SECRET"))
				.set("scope", "")
				.toString()
		}).json();
	
		await sb.Config.set("TWITCH_APP_ACCESS_TOKEN", token);
		
		console.log("Twitch app access token successfuly updated");
	})
};