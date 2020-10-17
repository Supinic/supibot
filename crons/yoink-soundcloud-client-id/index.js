module.exports = {
	Name: "yoink-soundcloud-client-id",
	Expression: "0 0 */8 * * *",
	Defer: null,
	Type: "All",
	Code: (async function yoinkSoundcloudClientID () {
		const url = "https://a-v2.sndcdn.com/assets/47-39f16f44-3.js";
		const code = await sb.Got(url).text();
		
		const match = code.match(/client_id:"(?<clientID>[\w\d]+)",env/);
		if (!match) {
			console.warn("No Soundcloud clientID detected!");
			return;
		}
	
		const { clientID } = match.groups;
	
		await sb.Config.set("SOUNDCLOUD_CLIENT_ID", clientID);
		sb.Utils.linkParser.reloadParser("soundcloud", { key: clientID });
	})
};