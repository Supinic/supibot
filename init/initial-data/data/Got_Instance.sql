INSERT INTO `data`.`Got_Instance` 
(`Name`,`Options_Type`,`Options`,`Parent`,`Description`)
VALUES
('Twitch','function','(() => ({
	prefixUrl: "https://twitch.tv",
	responseType: "json",
	headers: {
		Authorization: sb.Config.get("TWITCH_OAUTH", false),
		"User-Agent": sb.Config.get("DEFAULT_USER_AGENT")
	}
}))',NULL,'Catch-all Got instance for all Twitch API endpoints'),
('Helix','function','(() => ({
	prefixUrl: "https://api.twitch.tv/helix",
	responseType: "json",
	headers: {
		"Client-ID": sb.Config.get("TWITCH_CLIENT_ID", false),
		Authorization: `Bearer ${sb.Config.get("TWITCH_APP_ACCESS_TOKEN", false)}`,
		"User-Agent": sb.Config.get("DEFAULT_USER_AGENT")
	}
}))',NULL,'Twitch/Helix instance'),
('Kraken','function','(() => ({
	prefixUrl: "https://api.twitch.tv/kraken",
	responseType: "json",
	resolveBodyOnly: true,
	headers: {
		"Accept": "application/vnd.twitchtv.v5+json",
		"Client-ID": sb.Config.get("TWITCH_CLIENT_ID", false),
		"User-Agent": sb.Config.get("DEFAULT_USER_AGENT")
	},
	mutableDefaults: true
}))',NULL,'Twitch/V5 instance'),
('Leppunen','function','(() => ({
    responseType: "json",
    prefixUrl: "https://api.ivr.fi",
    headers: {
        "User-Agent": sb.Config.get("DEFAULT_USER_AGENT")
    },
    throwHttpErrors: false
}))',NULL,'Leppunen\'s API instance'),
('Supibot','function','(() => {
    const secure = sb.Config.get("SUPIBOT_API_SECURE", false) ?? false;
    const protocol = (secure) ? "https" : "http";
    const port = sb.Config.get("SUPIBOT_API_URL", false) ?? 80;

    return {
        responseType: "json",
        prefixUrl: `${protocol}://localhost:${port}`,
        headers: {
            "User-Agent": sb.Config.get("DEFAULT_USER_AGENT")
        },
        throwHttpErrors: false
    };
})',NULL,'Supibot internal API instance');