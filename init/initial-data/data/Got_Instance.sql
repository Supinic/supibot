INSERT INTO `data`.`Got_Instance` 
(`Name`,`Parent`,`Description`,`Options_Type`,`Options`)
VALUES
(
    'Global',
    NULL,
    'Global definition - isn\'t used on its own, just used as template for all others',
    'function',
    '(() => ({
        responseType: "json",
        retry: 0,
        timeout: 5000,
        mutableDefaults: true,
        throwHttpErrors: true,
        headers: {
            "User-Agent": sb.Config.get("DEFAULT_USER_AGENT")
        }
    }))'
),
(
    'Helix',
    'Global',
    NULL,
    'function',
    '(() => ({
     	prefixUrl: "https://api.twitch.tv/helix",
     	headers: {
     		"Client-ID": sb.Config.get("TWITCH_CLIENT_ID"),
     		"Authorization": `Bearer ${sb.Config.get("TWITCH_APP_ACCESS_TOKEN")}`
     	}
     }))'
),
(
    'Kraken',
    'Global',
    NULL,
    'function',
    '(() => ({
     	prefixUrl: "https://api.twitch.tv/kraken",
     	headers: {
		    "Accept": "application/vnd.twitchtv.v5+json",
     		"Client-ID": sb.Config.get("TWITCH_CLIENT_ID")
     	}
     }))'
),
(
    'Leppunen',
    'Global',
    NULL,
    'JSON',
    '{ "prefixUrl": "https://api.ivr.fi" }'
),
(
    'Supibot',
    'Global',
    'This is the internal API provided by Supibot and configured via sb.Config',
    'function',
    '(() => {
        const secure = sb.Config.get("SUPIBOT_API_SECURE", false) ?? false;
        const protocol = (secure) ? "https" : "http";
        const port = sb.Config.get("SUPIBOT_API_PORT", false) ?? 80;

        return {
            prefixUrl: `${protocol}://localhost:${port}`
        };
    })'
)
;