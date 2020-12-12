module.exports = {
	Name: "copypasta",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Fetches a random Twitch-related copypasta. The date of creation usually ranges from 2014-2015.",
	Flags: ["mention","non-nullable","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function copypasta () {
		const html = await sb.Got("https://www.twitchquotes.com/random").text();
		const $ = sb.Utils.cheerio(html);
		const copypasta = $(`div[id^="clipboard_copy_content"]`).text();
	
		return {
			reply: (copypasta)
				? sb.Utils.removeHTML(copypasta).trim()
				: "No copypasta found."
		};
	}),
	Dynamic_Description: null
};