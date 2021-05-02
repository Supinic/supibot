module.exports = {
	Name: "songrequestrandomgachi",
	Aliases: ["gsr","srg","srrg"],
	Author: "supinic",
	Cooldown: 60000,
	Description: "Posts a random gachi in the format \"!sr <link>\" to use on other bots' song request systems (such as StreamElements).",
	Flags: ["skip-banphrase","use-params","whitelist"],
	Params: [
		{ name: "fav", type: "string" },
	],
	Whitelist_Response: "Only available in specific whitelisted channels (for instance, those that have a song request bot that replies to \"!sr\").",
	Static_Data: (() => ({
		repeatLimit: 5
	})),
	Code: (async function songRequestRandomGachi (context, ...args) {
		const sr = sb.Command.get("songrequest");
		let hasSongRequestsAvailable = false;
		if (sr && sr.Flags.whitelist && context.channel) {
			const filters = sb.Filter.getLocals("Whitelist", {
				channel: context.channel,
				command: sr
			});

			hasSongRequestsAvailable = (filters.length > 0);
		}

		let link = null;
		let counter = 0;
		const rg = sb.Command.get("rg");
		const passedContext = sb.Command.createFakeContext(rg, {
			...context,
			params: {
				...context.params,
				linkOnly: true
			}
		});
	
		while (!link && counter < this.staticData.repeatLimit) {
			const execution = await rg.execute(passedContext, "linkOnly:true", ...args);
			if (execution.success === false) {
				return execution;
			}

			const data = await sb.Utils.linkParser.fetchData(execution.reply);
			if (data === null) {
				counter++;
	
				const videoID = sb.Utils.linkParser.parseLink(execution.reply);
				await sb.Query.getRecordUpdater(ru => ru
					.update("music", "Track")
					.set("Available", false)
					.where("Link = %s", videoID)
				);
			}
			else {
				link = execution.reply;
			}
		}
	
		if (counter >= this.staticData.repeatLimit) {
			return {
				success: false,
				reply: `Video fetching failed ${this.staticData.repeatLimit} times! Aborting...`
			};
		}

		if (hasSongRequestsAvailable) {
			const srContext = sb.Command.createFakeContext(rg, { ...context });
			await sr.execute(srContext, link);
		}
		else {
			return {
				reply: `!sr ${link}`
			};
		}
	}),
	Dynamic_Description: null
};