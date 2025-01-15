const { getLinkParser } = require("../../utils/link-parser.js");
const { postToHastebin } = require("../../utils/command-utils.js");

module.exports = {
	Name: "getvideodata",
	Aliases: ["gvd"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Uses supinic's API to fetch general info about a link, which is then posted to a Pastebin post.",
	Flags: ["developer","mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function getVideoData (context, link) {
		const linkParser = await getLinkParser();

		let data = null;
		try {
			data = await linkParser.fetchData(link);
		}
		catch {
			return { reply: "Unable to parse link." };
		}

		if (!data) {
			return { reply: "Link has been deleted or is otherwise not available." };
		}
		else {
			const string = JSON.stringify(data, null, 4);
			const paste = await postToHastebin(string, {
				name: `${data.name}, requested by ${context.user.Name}`
			});

			if (!paste.ok) {
				return {
					success: false,
					reply: paste.reason
				};
			}

			return {
				reply: paste.link
			};
		}
	}),
	Dynamic_Description: null
};
