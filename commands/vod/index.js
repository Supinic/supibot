module.exports = {
	Name: "vod",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Posts the last VOD of a specified channel. If you use the keyword \"current\", you'll get a timestamp as well.",
	Flags: ["mention"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function vod (context, target, type) {
		if ((target === "current" || target === "exact") && !type) {
			type = target;
			target = null;
		}
	
		if (!target) {
			if (context.platform.Name === "twitch") {
				target = context.channel.Name;
			}
			else {
				return {
					success: false,
					reply: "You must provide a channel, no default is available outside of Twitch!"
				};
			}
		}
	
		const channelID = await sb.Utils.getTwitchID(target);
		if (!channelID) {
			return {
				reply: "Invalid channel provided!"
			};
		}
	
		const vod = await sb.Got("Helix", {
			url: "videos",
			searchParams: "user_id=" + channelID
		}).json();
	
		if (vod.data.length === 0) {
			return {
				reply: "Target channel has no VODs saved!"
			};
		}
	
		let liveString = "";
		const isLive = (await sb.Command.get("streaminfo").execute(context, target)).reply;
		if (isLive && !isLive.includes("not exist") && !isLive.includes("offline")) {
			liveString = " 🔴";
		}
	
		const data = vod.data[0];
		const delta = sb.Utils.timeDelta(new sb.Date(data.created_at));
		const prettyDuration = data.duration.match(/\d+[hm]/g).join(", ");
	
		if (type === "current" || type === "exact") {
			if (!liveString) {			
				return {
					reply: `Channel is not currently live, no current/exact timestamp supported.`
				};
			}
	
			const offset = (type === "current") ? 90 : 0;
			const stamp = sb.Utils.parseDuration(data.duration, { target: "sec" }) - offset;
			return {
				reply: `${sb.Utils.capitalize(type)} VOD timestamp: ${data.url}?t=${(stamp < 0) ? 0 : stamp}s`
			};
		}
	
		return {
			reply: `${data.title} (length: ${prettyDuration}) - published ${delta} ${data.url}${liveString}`
		};
	}),
	Dynamic_Description: null
};