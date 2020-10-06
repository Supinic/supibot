module.exports = {
	Name: "songrequestrandomgachi",
	Aliases: ["gsr","srg","srrg"],
	Author: "supinic",
	Cooldown: 60000,
	Description: "Posts a random gachi in the format \"!sr <link>\" to use on other bots' song request systems (such as StreamElements).",
	Flags: ["skip-banphrase","whitelist"],
	Whitelist_Response: "Only available in specific whitelisted channels (for instance, those that have a song request bot that replies to \"!sr\").",
	Static_Data: (() => ({
		repeatLimit: 5
	})),
	Code: (async function songRequestRandomGachi (context, ...args) {
		let link = null;
		let counter = 0;
		const rg = sb.Command.get("rg");
	
		while (!link && counter < this.staticData.repeatLimit) {
			const execution = await rg.execute({}, "linkOnly:true", ...args);
			const data = await sb.Utils.linkParser.fetchData(execution.link);
	
			if (data === null) {
				counter++;
	
				const videoID = sb.Utils.linkParser.parseLink(execution.link);
				await sb.Query.getRecordUpdater(ru => ru
					.update("music", "Track")
					.set("Available", false)
					.where("Link = %s", videoID)
				);
			}
			else {
				link = execution.link
			}
		}
	
		if (counter >= this.staticData.repeatLimit) {
			return {
				success: false,
				reply: `Video fetching failed ${this.staticData.repeatLimit} times! Aborting request...`
			};
		}
	
		return {
			reply: `!sr ${link}`
		}
	}),
	Dynamic_Description: null
};