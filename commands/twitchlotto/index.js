module.exports = {
	Name: "twitchlotto",
	Aliases: ["tl"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a random Imgur image from a Twitch channel (based off Twitchlotto) and checks it for NSFW stuff via an AI. The \"NSFW score\" is posted along with the link.",
	Flags: ["mention"],
	Params: [
		{ name: "excludeChannel", type: "string" },
		{ name: "excludeChannels", type: "string" },
		{ name: "forceUnscored", type: "boolean" },
		{ name: "preferUnscored", type: "boolean" }
	],
	Whitelist_Response: "This command can't be executed here!",
	Static_Data: null,
	Code: (async function twitchLotto (context, channel) {
		const definitions = require("./definitions.js");
		const checkSafety = require("./safety-check.js");

		if (!this.data.channels) {
			this.data.channels = await sb.Query.getRecordset(rs => rs
				.select("LOWER(Name) AS Name")
				.from("data", "Twitch_Lotto_Channel")
				.flat("Name")
			);
		}

		if (context.params.forceUnscored && context.params.preferUnscored) {
			return {
				success: false,
				reply: `Parameters forceUnscored and preferUnscored cannot be both set to true at the same time!`
			};
		}

		let randomRoll = false;
		const excludedInput = context.params.excludeChannel ?? context.params.excludeChannels;
		if (excludedInput) {
			if (channel) {
				return {
					success: false,
					reply: "Cannot combine channels exclusion with a specified channel!"
				};
			}

			const excludedChannels = excludedInput.split(/\W/).filter(i => this.data.channels.includes(i));
			let availableChannels = this.data.channels.filter(i => !excludedChannels.includes(i));

			if (context.params.forceUnscored) {
				const eligibleChannels = await sb.Query.getRecordset(rs => rs
					.select("LOWER(Name) AS Name")
					.from("data", "Twitch_Lotto_Channel")
					.where("Amount > Scored")
					.flat("Name")
				);

				availableChannels = availableChannels.filter(i => eligibleChannels.includes(i));
			}

			if (availableChannels.length === 0) {
				return {
					success: false,
					reply: "There are no channels left to pick any images from!"
				};
			}

			channel = sb.Utils.randArray(availableChannels);
		}

		if (channel) {
			channel = channel.toLowerCase();

			if (channel === "random") {
				randomRoll = true;

				let eligibleChannels = this.data.channels;
				if (context.params.forceUnscored) {
					eligibleChannels = await sb.Query.getRecordset(rs => rs
						.select("LOWER(Name) AS Name")
						.from("data", "Twitch_Lotto_Channel")
						.where("Amount > Scored")
						.flat("Name")
					);
				}

				channel = sb.Utils.randArray(eligibleChannels);
			}

			if (!this.data.channels.includes(channel)) {
				return {
					success: false,
					reply: "This channel is not currently supported!"
				};
			}
		}

		// Preparation work that does not need to run more than once, so it is placed before the loop below.
		if (!this.data.counts) {
			let total = 0;
			const countData = await sb.Query.getRecordset(rs => rs
				.select("Name", "Amount")
				.from("data", "Twitch_Lotto_Channel")
			);

			this.data.counts = {};
			for (const row of countData) {
				total += row.Amount;
				this.data.counts[row.Name] = row.Amount;
			}

			this.data.counts.total = total;
		}

		let safeMode = true;
		let blacklistedFlags = [];
		if (context.channel) {
			const unsafeMode = await context.channel.getDataProperty("twitchLottoNSFW");

			safeMode = (typeof unsafeMode === "boolean") ? !unsafeMode : true;
			blacklistedFlags = await context.channel.getDataProperty("twitchLottoBlacklistedFlags") ?? [];
		}

		// Now try to find an image that is available.
		let image = null;
		let failedTries = 0;
		while (image === null) {
			if (safeMode) {
				image = await sb.Query.getRecordset(rs => rs
					.select("*")
					.from("data", "Twitch_Lotto")
					.where({ condition: Boolean(channel) }, "Channel = %s", channel)
					.where("Score IS NOT NULL")
					.where("Available IS NULL OR Available = %b", true)
					.where("Adult_Flags IS NULL OR Adult_Flags = %s", "None")
					.orderBy("RAND()")
					.limit(1)
					.single()
				);

				if (!image) {
					return {
						success: false,
						reply: `Cannot post any pictures from channel ${channel}! This is because this channel has safe mode enabled.`
					};
				}
			}
			else if (context.params.forceUnscored) {
				if (safeMode) {
					return {
						success: false,
						reply: `Cannot use the "forceUnscored" parameter in safe mode!`
					};
				}
				else if (!channel) {
					return {
						success: false,
						reply: `When using the forceUnscored parameter, a channel must be provided!`
					};
				}

				image = await sb.Query.getRecordset(rs => rs
					.select("*")
					.from("data", "Twitch_Lotto")
					.where("Channel = %s", channel)
					.where("Score IS NULL")
					.where("Available IS NULL OR Available = %b", true)
					.orderBy("RAND()")
					.limit(1)
					.single()
				);

				if (!image) {
					return {
						success: false,
						reply: `All the images have been scored in this channel!`
					};
				}
			}
			else if (channel) {
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
				const link = await sb.Query.getRecordset(rs => rs
					.select("Link")
					.from("data", "Twitch_Lotto")
					.orderBy("Link ASC")
					.limit(1)
					.offset(roll)
					.single()
					.flat("Link")
				);

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
			else if (context.param.preferUnscored && image.Score !== null && failedTries < definitions.maxRetries) {
				// "soft" re-attempting. only attempt again if the limit hasn't been reached.
				// if it has, continue ahead and use the last image rolled, regardless of if it has the Score value or not
				failedTries++;
				image = null;
			}

			if (image) {
				const legalityCheck = checkSafety(safeMode, blacklistedFlags, image);
				if (legalityCheck.success === false) {
					failedTries++;
					image = null;
				}
			}

			if (failedTries > definitions.maxRetries) {
				// Was not able to find an image that existed.
				return {
					success: false,
					reply: `Could not find an image that was still available (${definitions.maxRetries} images were checked and found to be deleted)!`,
					cooldown: 2500
				};
			}
			// Success: image is not null, and loop will terminate.
		}

		if (image.Score === null) {
			const link = `https://i.imgur.com/${image.Link}`;
			const { statusCode, data } = await sb.Utils.checkPictureNSFW(link);
			if (statusCode !== 200) {
				return {
					success: false,
					reply: `Fetching image data for link ${link} failed! Status code ${statusCode}`
				};
			}

			const json = JSON.stringify({ detections: data.detections, nsfw_score: data.score });
			await sb.Query.getRecordUpdater(ru => ru
				.update("data", "Twitch_Lotto")
				.set("Score", data.score)
				.set("Data", json)
				.where("Link = %s", image.Link)
			);

			const channels = await sb.Query.getRecordset(rs => rs
				.select("Channel")
				.from("data", "Twitch_Lotto")
				.where("Link = %s", image.Link)
				.flat("Channel")
			);

			for (const channel of channels) {
				const row = await sb.Query.getRow("data", "Twitch_Lotto_Channel");
				await row.load(channel);
				if (row.values.Scored !== null) {
					row.values.Scored += 1;
					await row.save({ skipLoad: true });
				}
			}

			image.Data = json;
			image.Score = sb.Utils.round(data.score, 4);

			const legalityCheck = checkSafety(safeMode, blacklistedFlags, image);
			if (legalityCheck.success === false) {
				return legalityCheck;
			}
		}

		const detectionsString = [];
		const { detections } = JSON.parse(image.Data);
		for (const { replacement, string } of definitions.detections) {
			const elements = detections.filter(i => i.name === string);
			const strings = elements.map(i => `${replacement} (${Math.round(i.confidence * 100)}%)`);
			detectionsString.push(...strings);
		}

		await this.setCacheData(definitions.createRecentUseCacheKey(context), image.Link, {
			expiry: 600_000
		});

		let channelString = "";
		if (!channel || randomRoll || excludedInput) {
			const channels = await sb.Query.getRecordset(rs => rs
				.select("Channel")
				.from("data", "Twitch_Lotto")
				.where("Link = %s", image.Link)
				.flat("Channel")
			);

			channelString = `Posted in channel(s): ${channels.join(", ")}`;
		}

		const descriptionData = await sb.Query.getRecordset(rs => rs
			.select("Text")
			.from("data", "Twitch_Lotto_Description")
			.where("Link = %s", image.Link)
			.orderBy("Preferred DESC")
			.orderBy("Created ASC")
			.limit(1)
			.single()
		);

		const descriptionString = (descriptionData?.Text)
			? `Description: ${descriptionData.Text}`
			: "";

		const flagsString = (image.Adult_Flags)
			? `NSFW flags: ${image.Adult_Flags.join(", ")}`
			: "";

		const scoreThresholdExceeded = ((image.Score > 0.5 && detections.length > 0) || (image.Score > 0.75));
		return {
			removeEmbeds: (context.channel && !context.channel.NSFW && scoreThresholdExceeded),
			reply: sb.Utils.tag.trim `
				NSFW score: ${definitions.formatScore(image.Score)}
				Detections: ${detectionsString.length === 0 ? "N/A" : detectionsString.join(", ")}
				${flagsString}
				https://i.imgur.com/${image.Link}
				${channelString}
				${descriptionString}
			`
		};
	}),
	Dynamic_Description: (async function (prefix) {
		const { taggingGuide, flags, scoreThreshold } = require("./definitions.js");
		const thresholdPercent = `${sb.Utils.round(scoreThreshold * 100, 2)}%`;

		const countData = await sb.Query.getRecordset(rs => rs
			.select("Name", "Amount", "LEAST(Amount, Scored) AS Scored")
			.from("data", "Twitch_Lotto_Channel")
			.orderBy("Amount DESC")
		);

		const data = countData.map(i => sb.Utils.tag.trim `
			<tr>
				<td>${i.Name}</td>
				<td data-order=${i.Amount}>${sb.Utils.groupDigits(i.Amount)}</td>
				<td data-order=${i.Scored}>${sb.Utils.groupDigits(i.Scored)}</td>
				<td>${sb.Utils.round(100 * i.Scored / i.Amount, 2)}%</td>
			</tr>
		`).join("\n");

		const flagList = flags.map(flagData => {
			const { name, wrong, correct, description } = flagData;
			const examples = [
				...correct.map(i => `<li>Correct: ${i}</li>`),
				...wrong.map(i => `<li>Wrong: ${i}</li>`)
			];

			return sb.Utils.tag.trim `
				<li>
					<code>${name}</code> - ${description}
					<ul>
						${examples.join("")}
					</ul>
				</li>
			`;
		}).join("");

		return [
			`<script>
				window.addEventListener("load", () => $("#twitch-lotto-meta").DataTable({
					searching: false,
					lengthChange: false,
					pageLength: 50
				}));
			</script>`,

			`Rolls a random picture sourced from Twitch channels. The data is gathered from the <a href="//twitchlotto.com">Twitchlotto website</a>`,
			"You can specify a channel from the list below to get links only from there.",
			`You will get an approximation of "NSFW score" by an AI, so keep an eye out for that.`,
			"",

			"<h5> Safe mode </h5>",
			`All channels start with "Safe mode" turned on by default. In this mode, strict filtering is applied:`,
			`<ul>
				<li>Only already scored images are available</li>
				<li>Only images with manual confirmation of no adult content are available</li>
				<li>Only images below the threshold of ${thresholdPercent} NSFW can be posted</li>
			</ul>`,

			"All channels are in safe mode by default - except for explicit NSFW channels on Discord.",
			`This check can be disabled - at the channel owner's (or ambassador's) risk - via the <a href="/bot/command/detail/set">$set twitch-lotto-nsfw</a> command. Check it for more info.`,
			"",

			"<h5> Data gathering </h5>",
			"If you would like to help out and make the command more usable for everyone else, you have several options in which you can provide your input!",

			`<ul>
				<li><code>${prefix}set tl (link) (flags)</code> - Adds NSFW flags to an image. More info: see below.</li>
				<li><code>${prefix}set tld (link) (description)</code> - Adds a description to an image. More info: <a href="/bot/command/detail/set">$set</a></li>
				<li><code>${prefix}tle (link)</code> - If an image has NSFW detections, this will highlight them. More info: <a href="/bot/command/detail/twitchlottoexplain">$tle</a></li>
			</ul>`,

			"<h5>NSFW flags guide</h5>",
			...taggingGuide,
			"",

			`<ul>${flagList}</ul>`,

			"<h5> Command usage </h5>",
			`<code>${prefix}tl</code>`,
			`<code>${prefix}twitchlotto</code>`,
			"Fetches a random image from any channel - channels with more images have a bigger chance to be picked",
			"",

			`<code>${prefix}tl random</code>`,
			"Fetches a random image from any channel - all channels have the same chance to be picked",
			"",

			`<code>${prefix}tl (channel)</code>`,
			"Fetches a random image from the specified channel",
			"",

			`<code>${prefix}tl preferUnscored:true</code>`,
			"If set to true, the command will prefer to roll images that have not been scored yet.",
			"After several unsuccessful lookups however, the fetching is going to revert to an already scored image, if it wasn't able to find one.",
			"",

			`<code>${prefix}tl forceUnscored:true</code>`,
			"If set to true, the command will forcefully roll an image that has no score set yet.",
			"<b>WARNING:</b> Using the command with this parameter will result in a lot slower execution.",
			"",

			`<code>${prefix}tl excludeChannel:forsen</code>`,
			"Fetches a random image from any but the specified excluded channel",
			"",

			`<code>${prefix}tl excludeChannel:"forsen,nymn,pajlada"</code>`,
			"Fetches a random image from any but the specified excluded channels, separated by spaces or commas",
			"",

			"Supported channels:",
			`<table id="twitch-lotto-meta">
				<thead>
					<tr>
						<th><b>Name</b></tdh>
						<th><b>Total amount</b></th>
						<th><b>Scored by API</b></th>
						<th><b>Completion</b></th>
					</tr>
				</thead>
				<tbody>
					${data}
				</tbody>					
			</table>`,
		];
	})
};
