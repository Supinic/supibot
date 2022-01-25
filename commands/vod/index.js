module.exports = {
	Name: "vod",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Posts the last VOD of a specified channel. If you use the keyword \"current\", you'll get a timestamp as well.",
	Flags: ["mention"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function vod (context, target) {
		if (!target) {
			if (context.platform.Name === "twitch") {
				if (!context.channel) {
					return {
						success: false,
						reply: "No channel provided - there is no default channel in whispers!"
					};
				}

				target = context.channel.Name;
			}
			else {
				return {
					success: false,
					reply: "No channel provided - there is no default channel outside of Twitch!"
				};
			}
		}

		const { controller } = sb.Platform.get("twitch");
		const channelID = await controller.getUserID(target);
		if (!channelID) {
			return {
				reply: "Invalid channel provided!"
			};
		}

		const response = await sb.Got("Helix", {
			url: "videos",
			searchParams: `user_id=${channelID}`
		});

		const vod = response.body;
		if (!vod.data || vod.data.length === 0) {
			return {
				reply: "Target channel has no VODs saved!"
			};
		}

		const streamResponse = await sb.Got("Helix", {
			url: "streams",
			searchParams: {
				user_id: channelID
			}
		});

		const data = vod.data[0];
		const delta = sb.Utils.timeDelta(new sb.Date(data.created_at));
		const isLive = Boolean(streamResponse.body.data[0]);

		if (isLive) {
			const offset = 90; // Implicitly offset the VOD by several seconds, to account for inaccuracies
			const stamp = sb.Utils.parseDuration(data.duration, { target: "sec" }) - offset;
			return {
				reply: `Started ${delta}: ${data.title}  ${data.url}?t=${(stamp < 0) ? 0 : stamp}s`
			};
		}

		const prettyDuration = data.duration.match(/\d+[hms]/g).join(", ");
		return {
			reply: `Published ${delta}: ${data.title} (length: ${prettyDuration}) ${data.url}`
		};
	}),
	Dynamic_Description: null
};
