module.exports = {
	Name: "twitchlottoexplain",
	Aliases: ["tle"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "For a given processed TwitchLotto link, creates a version where the detections are marked with boxes.",
	Flags: ["mention"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function twitchLotto (context, inputLink) {
		const filtered = await sb.Filter.execute({
			user: context.user,
			command: sb.Command.get("tl"),
			channel: context.channel,
			platform: context.platform,
			targetUser: null
		});

		if (!filtered.success) {
			return {
				success: false,
				reply: `You can't use this command here! That's because the $tl command is not available here either.`
			};
		}

		if (!inputLink) {
			return {
				success: false,
				reply: `No image link provided!`
			};
		}

		if (inputLink === "last") {
			const tl = sb.Command.get("tl");
			const key = tl.staticData.createRecentUseCacheKey(context);
			const cacheData = await tl.getCacheData(key);

			if (cacheData) {
				inputLink = cacheData;
			}
			else {
				return {
					success: false,
					reply: "You haven't rolled for any images in this channel recently!"
				};
			}
		}

		const link = sb.Utils.getPathFromURL(inputLink);
		if (!link) {
			return {
				success: false,
				reply: `Invalid image link provided!`
			};
		}

		const linkData = await sb.Query.getRecordset(rs => rs
			.select("Data")
			.from("data", "Twitch_Lotto")
			.where("Link = %s", link)
			.limit(1)
			.single()
		);

		if (!linkData) {
			return {
				success: false,
				reply: `This image does not exist in the TwitchLotto database!`
			};
		}
		else if (!linkData.Data) {
			return {
				success: false,
				reply: `This image link has no data yet!`
			};
		}

		const data = JSON.parse(linkData.Data);
		if (!data.detections || data.detections.length === 0) {
			return {
				success: false,
				reply: `There are no detections on this image!`
			};
		}
		else if (data.explainLink) {
			return {
				reply: data.explainLink
			};
		}

		const { promisify } = require("util");
		const stream = require("stream");
		const pipeline = promisify(stream.pipeline);
		const shell = promisify(require("child_process").exec);
		const fs = require("fs");

		// await shell(`wget https://i.imgur.com/${link} -P /tmp`);

		const downloadStream = sb.Got.stream(`https://i.imgur.com/${link}`);
		const writeStream = fs.createWriteStream(`/tmp/${link}`);
		await pipeline(downloadStream, writeStream);

		const colours = ["#0F0", "#F00", "#00F", "#FF0", "#0FF", "#F0F"];
		const params = data.detections.map((i, ind) => {
			const coords = i.bounding_box;
			return sb.Utils.tag.trim `
				-strokewidth 7
				-stroke '${colours[ind]}'
				-fill 'none' 
				-draw 'rectangle ${coords[0]},${coords[1]},${coords[0] + coords[2]},${coords[1] + coords[3]}'
			`;
		}).join(" ");

		await shell(`convert /tmp/${link} ${params} /tmp/out_${link}`);
		await fs.promises.unlink(`/tmp/${link}`);

		const outputFile = await fs.promises.readFile(`/tmp/out_${link}`);
		const { statusCode, link: outputLink } = await sb.Utils.uploadToImgur(outputFile, link);

		await fs.promises.unlink(`/tmp/out_${link}`);

		if (statusCode !== 200) {
			return {
				success: false,
				reply: `Image upload failed with code ${statusCode}!`
			};
		}

		data.explainLink = outputLink;
		await sb.Query.getRecordUpdater(ru => ru
			.update("data", "Twitch_Lotto")
			.set("Data", JSON.stringify(data))
			.where("Link = %s", link)
		);

		return {
			reply: outputLink
		};
	}),
	Dynamic_Description: null
};
