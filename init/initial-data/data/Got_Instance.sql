INSERT INTO `data`.`Got_Instance` 
(`ID`,`Name`,`Options_Type`,`Options`,`Parent`,`Description`)
VALUES
(1,'Twitch','function','(() => ({
	prefixUrl: "https://twitch.tv",
	responseType: "json",
	headers: {
		Authorization: sb.Config.get("TWITCH_OAUTH", false),
		"User-Agent": sb.Config.get("DEFAULT_USER_AGENT")
	}
}))',NULL,'Catch-all Got instance for all Twitch API endpoints'),
(2,'Helix','function','(() => ({
	prefixUrl: "https://api.twitch.tv/helix",
	responseType: "json",
	headers: {
		"Client-ID": sb.Config.get("TWITCH_CLIENT_ID", false),
		Authorization: `Bearer ${sb.Config.get("TWITCH_APP_ACCESS_TOKEN", false)}`,
		"User-Agent": sb.Config.get("DEFAULT_USER_AGENT")
	}
}))',1,'Twitch/Helix instance'),
(3,'Kraken','function','(() => ({
	prefixUrl: "https://api.twitch.tv/kraken",
	responseType: "json",
	resolveBodyOnly: true,
	headers: {
		"Accept": "application/vnd.twitchtv.v5+json",
		"Client-ID": sb.Config.get("TWITCH_CLIENT_ID", false),
		"User-Agent": sb.Config.get("DEFAULT_USER_AGENT")
	},
	mutableDefaults: true
}))',1,'Twitch/V5 instance'),
(4,'Pastebin','JSON','{
	"prefixUrl": "https://pastebin.com/",
	"headers": {
		"Content-Type": "application/x-www-form-urlencoded"
	}
}',NULL,'Pastebin instance')

ON DUPLICATE KEY UPDATE ID = ID;