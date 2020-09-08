module.exports = {
	Name: "getvideodata",
	Aliases: ["gvd"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 5000,
	Description: "Uses supinic's API to fetch general info about a link, which is then posted to a Pastebin post.",
	Flags: ["developer","mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function getVideoData (context, link) {
		let data = null;
		try {
			data = await sb.Utils.linkParser.fetchData(link);
		}
		catch (e) {
			return { reply: "Unable to parse link." };
		}
	
		if (!data) {
			return { reply: "Link has been deleted or is otherwise not available." };
		}
		else {
			const link = await sb.Pastebin.post(JSON.stringify(data, null, 4), {
				name: data.name + ", requested by " + context.user.Name,
				format: "json"
			});
	
			return { reply: link };
		}
	}),
	Dynamic_Description: null
};