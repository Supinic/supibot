module.exports = {
	Name: "followage",
	Aliases: ["fa"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the followage for a given user and a channel. If no channel is provided, checks the current one. If no user is provided either, checks yourself.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function followAge (context, user, channel) {
		if (!channel && user) {
			channel = user;
			user = context.user.Name;
		}

		if (!channel) {
			if (!context.channel) {
				return {
					success: false,
					reply: "You must provide a specific channel in PMs!"
				};
			}
			else if (context.platform.Name !== "twitch") {
				return {
					success: false,
					reply: "You must provide a specific channel in non-Twitch channels!"
				};
			}
		}

		channel ??= context.channel.Name;
		user ??= context.user.Name;

		if (user === channel.toLowerCase()) {
			if (user === context.user.Name) {
				const emote = await context.getBestAvailableEmote(["PepeLaugh", "LULW", "LuL", "4Head"], "😀");
				return {
					success: false,
					reply: `Good luck following yourself! ${emote}`
				};
			}
			else {
				const emote = await context.getBestAvailableEmote(["FeelsDankMan", "FailFish"], "🙄");
				return {
					success: false,
					reply: `People can't follow themselves! ${emote}`
				};
			}
		}

		const { controller } = sb.Platform.get("twitch");
		const [userID, channelID] = await Promise.all([
			controller.getUserID(user),
			controller.getUserID(channel)
		]);

		if (!userID || !channelID) {
			return {
				success: false,
				reply: "One or both users were not found!"
			};
		}

		const response = await sb.Got("Helix", {
			url: "users/follows",
			searchParams: {
				from_id: userID,
				to_id: channelID
			}
		});

		const prefix = (user.toLowerCase() === context.user.Name) ? "You" : user;
		const suffix = (channel.toLowerCase() === context.user.Name) ? "you" : channel;

		const [followData] = response.body.data;
		if (!followData) {
			const verb = (user.toLowerCase() === context.user.Name) ? "are" : "is";
			return {
				reply: `${prefix} ${verb} not following ${suffix}.`
			};
		}

		const verb = (user.toLowerCase() === context.user.Name) ? "have" : "has";
		const delta = sb.Utils.timeDelta(new sb.Date(followData.followed_at), true, true);
		return {
			reply: `${prefix} ${verb} been following ${suffix} for ${delta}.`
		};
	}),
	Dynamic_Description: null
};
