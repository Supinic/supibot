module.exports = {
	Name: "twitchlotto",
	Aliases: ["tl"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a random Imgur image from a Twitch channel (based off Twitchlotto) and checks it for NSFW stuff via an AI. The \"nudity score\" is posted along with the link.",
	Flags: ["mention","whitelist"],
	Params: [
		{ name: "excludeChannel", type: "string" }
	],
	Whitelist_Response: "This command can't be executed here!",
	Static_Data: (() => {
		this.data.counts = {};
		return {
			detections: [
				{
					string: "Male Breast - Exposed",
					replacement: "male breast"
				},
				{
					string: "Male Genitalia - Exposed",
					replacement: "penis"
				},
				{
					string: "Male Genitalia - Covered",
					replacement: "covered penis"
				},
				{
					string: "Female Genitalia - Exposed",
					replacement: "vagina"
				},
				{
					string: "Female Breast - Exposed",
					replacement: "breast"
				},
				{
					string: "Female Breast - Covered",
					replacement: "covered breast"
				},
				{
					string: "Buttocks - Exposed",
					replacement: "ass"
				}
			],
			maxRetries: 3,
			createRecentUseCacheKey: (context) => {
				return {
					type: "recent-use",
					user: context.user.ID,
					channel: context.channel?.ID ?? null
				};
			}
		};
	}),
	Code: (async function twitchLotto (context, channel) {
		if (!this.data.channels) {
			this.data.channels = await sb.Query.getRecordset(rs => rs
				.select("LOWER(Name) AS Name")
				.from("data", "Twitch_Lotto_Channel")
				.flat("Name")
			);
		}
		
		if (channel) {
			channel = channel.toLowerCase();
			
			if (!this.data.channels.includes(channel)) {
				return {
					success: false,
					reply: "The channel you provided has no images saved!"
				};
			}
			else if (context.params.excludeChannel``) {
				return {
					success: false,
					reply: "Cannot combine the excludeChannel parameter with a specified channel!"
				};
			}
		}
	
		// Preparation work that does not need to run more than once, so it is placed before the loop below.
		if (channel) {
			if (!this.data.counts[channel]) {
				this.data.counts[channel] = await sb.Query.getRecordset(rs => rs
					.select("Amount")
					.from("data", "Twitch_Lotto_Channel")
					.where("Name = %s", channel)
					.single()
					.flat("Amount")
				);
			}
		}
		else {
			if (!this.data.counts.total) {
				this.data.counts.total = await sb.Query.getRecordset(rs => rs
					.select("SUM(Amount) AS Amount")
					.from("data", "Twitch_Lotto_Channel")
					.single()
					.flat("Amount")
				);
			}
		}
	
		// Now try to find an image that is available.
		let image = null;
		let failedTries = 0;
		while (image === null) {
			if (channel) {
				const roll = sb.Utils.random(1, this.data.counts[channel]) - 1;
				image = await sb.Query.getRecordset(rs => rs
					.select("*")
					.from("data", "Twitch_Lotto")
					.where("Channel = %s", channel)
					.offset(roll)
					.limit(1)
					.single()
				);
			}
			else {
				const roll = sb.Utils.random(1, this.data.counts.total);
				const link = await sb.Query.getRecordset(rs => {
					rs.select("Link")
						.from("data", "Twitch_Lotto")
						.orderBy("Link ASC")
						.limit(1)
						.offset(roll)
						.single()
						.flat("Link");

					if (context.params.excludeChannel) {
						rs.where("Channel NOT IN %s+", context.params.excludeChannel.split(/\W/));
					}

					return rs;
				});
	
				image = await sb.Query.getRecordset(rs => rs
					.select("*")
					.from("data", "Twitch_Lotto")
					.where("Link = %s", link)
					.single()
				);
			}
	
			if (image.Available === false) {
				// discard this image. Loop will continue.
				failedTries++;
				image = null;
			}
			else if (image.Available === null) {
				const { statusCode } = await sb.Got({
					method: "HEAD",
					throwHttpErrors: false,
					followRedirect: false,
					url: `https://i.imgur.com/${image.Link}`
				});
	
				if (statusCode !== 200) {
					await sb.Query.getRecordUpdater(ru => ru
						.update("data", "Twitch_Lotto")
						.set("Available", false)
						.where("Link = %s", image.Link)
					);
	
					// discard this image. Loop will continue.
					failedTries++;
					image = null;
				}
			}
	
			if (failedTries > this.staticData.maxRetries) {
				// Was not able to find an image that existed.
				return {
					success: false,
					reply: `Could not find an image that was still available (${this.staticData.maxRetries} images were checked and found to be deleted)!`,
					cooldown: 2500
				};
			}
			// Success: image is not null, and loop will terminate.
		}
	
		if (image.Score === null) {
			const { statusCode, body: resultData } = await sb.Got({
				method: "POST",
				responseType: "json",
				throwHttpErrors: false,
				url: "https://api.deepai.org/api/nsfw-detector",
				headers: {
					"Api-Key": sb.Config.get("API_DEEP_AI")
				},
				form: {
					image: `https://i.imgur.com/${image.Link}`
				}
			});
	
			if (statusCode !== 200) {
				console.log({ statusCode, resultData });
				return {
					success: false,
					reply: `Fetching image data failed! Status code ${statusCode}`
				};
			}
	
			const json = JSON.stringify(resultData.output);
			await sb.Query.getRecordUpdater(ru => ru
				.update("data", "Twitch_Lotto")
				.set("Score", resultData.output.nsfw_score)
				.set("Data", json)
				.where("Link = %s", image.Link)
				.where("Channel = %s", image.Channel)
			);
	
			image.Data = json;
			image.Score = sb.Utils.round(resultData.output.nsfw_score, 4);
		}
	
		const detectionsString = [];
		const { detections } = JSON.parse(image.Data);
		for (const { replacement, string} of this.staticData.detections) {
			const elements = detections.filter(i => i.name === string);
			const strings = elements.map(i => `${replacement} (${Math.round(i.confidence * 100)}%)`);
			detectionsString.push(...strings);
		}
	
		const blacklistedFlags = context.channel?.Data.twitchLottoBlacklistedFlags ?? [];
		const imageFlags = image.Adult_Flags ?? [];
	
		const illegalFlags = imageFlags.map(i => i.toLowerCase()).filter(i => blacklistedFlags.includes(i));
		if (illegalFlags.length > 0) {
			return {
				success: false,
				reply: "Cannot post image! These flags are blacklisted: " + illegalFlags.join(", ")
			};
		}
	
		await this.setCacheData(this.staticData.createRecentUseCacheKey(context), image.Link, {
			expiry: 600_000
		});

		let channelString = "";
		if (!channel) {
			const channels = await sb.Query.getRecordset(rs => rs
			    .select("Channel")
			    .from("data", "Twitch_Lotto")
				.where("Link = %s", image.Link)
				.flat("Channel")
			);

			channelString = "Posted in channel(s): " + channels.join(", ");
		}

		const flagsString = (image.Adult_Flags)
			? `Manual NSFW flags: ${image.Adult_Flags.join(", ")}`
			: "";
	
		return {
			reply: sb.Utils.tag.trim `
				NSFW score: ${sb.Utils.round(image.Score * 100, 2)}%
				Detections: ${detectionsString.length === 0 ? "N/A" : detectionsString.join(", ")}
				${flagsString}
				https://i.imgur.com/${image.Link}
				${channelString}
			`
		};
	}),
	Dynamic_Description: (async (prefix) => {
		const rawChannels = await sb.Query.getRecordset(rs => rs
			.select("Name")
			.from("data", "Twitch_Lotto_Channel")
			.flat("Name")
		);
	
		const channels = rawChannels.map(i => `<li>${i}</li>`).join("");
		return [
			"Rolls a random picture sourced from Twitch channels. The data is from the Twitchlotto website",
			"You can specify a channel from the list below to get links only from there.",
			"Caution! The images are not filtered by any means and can be NSFW.",
			`You will get an approximation of "NSFW score" by an AI, so keep an eye out for that.`,
			"",
	
			`<code>${prefix}twitchlotto</code>`,
			"Fetches a random image from any channel",
			"",
			
			`<code>${prefix}twitchlotto (channel)</code>`,
			"Fetches a random image from the specified channel",
			"",

			`<code>${prefix}twitchlotto excludeChannel:forsen</code>`,
			"Fetches a random image from any but the specified excluded channel",
			"",

			`<code>${prefix}twitchlotto excludeChannel:"forsen,nymn,pajlada"</code>`,
			"Fetches a random image from any but the specified excluded channels, separated by spaces or commas",
			"",
	
			"Supported channels:",
			`<ul>${channels}</ul>`
		];
	})
};