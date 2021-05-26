module.exports = {
	Name: "getvideodata",
	Aliases: ["gvd"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Uses supinic's API to fetch general info about a link, which is then posted to a Pastebin post.",
	Flags: ["developer","mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function getVideoData (context, link) {
		let data = null;
		try {
			data = await sb.Utils.modules.linkParser.fetchData(link);
		}
		catch (e) {
			return { reply: "Unable to parse link." };
		}
	
		if (!data) {
			return { reply: "Link has been deleted or is otherwise not available." };
		}
		else {
			const string = JSON.stringify(data, null, 4);
			const paste = await sb.Pastebin.post(string, {
				name: `${data.name}, requested by ${context.user.Name}`,
				format: "json"
			});

			if (paste.success !== true) {
				return {
					success: false,
					reply: paste.error ?? paste.body
				};
			}
	
			return {
				reply: paste.body
			};
		}
	}),
	Dynamic_Description: null
};
