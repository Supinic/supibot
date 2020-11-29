module.exports = {
	Name: "firstfollowedchannel",
	Aliases: ["ffc"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the first channel you or someone else have ever followed on Twitch.",
	Flags: ["mention","opt-out","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function firstFollowedChannel (context, target) {
		const { controller } = sb.Platform.get("twitch");
		const channelID = await controller.getUserID(target ?? context.user.Name);
		if (!channelID) {
			return {
				success: false,
				reply: "Could not match user to a Twitch user ID!"
			};
		}
	
		const { follows } = await sb.Got("Kraken", {
			url: `users/${channelID}/follows/channels`,
			searchParams: new sb.URLParams()
				.set("limit", "10") // If the limit is 1, and the followed channel is banned, then no response will be used...
				.set("direction", "asc")
				.set("sortby", "created_at")
				.toString()
		}).json();

		const who = (!target || context.user.Name === target.toLowerCase())
			? "you"
			: "they";

		if (follows.length === 0) {
			return {
				reply: `${sb.Utils.capitalize(who)} don't follow anyone.`
			};
		}
		else {
			const follow = follows[0];
			const delta = sb.Utils.timeDelta(new sb.Date(follow.created_at));
			return {
				reply: `The oldest channel ${who} still follow is ${follow.channel.display_name}, since ${delta}.`
			};
		}
	}),
	Dynamic_Description: null
};