module.exports = {
	Name: "firstchannelfollower",
	Aliases: ["fcf"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the first user that follows you or someone else on Twitch.",
	Flags: ["mention","non-nullable","opt-out","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function firstChannelFollower (context, target) {
		const { controller } = sb.Platform.get("twitch");
		const channelID = await controller.getUserID(target ?? context.user.Name);
		if (!channelID) {
			return {
				success: false,
				reply: "Could not match user to a Twitch user ID!"
			};
		}

		const response = await sb.Got("Kraken", {
			url: `channels/${channelID}/follows`,
			searchParams: {
				direction: "asc"
			}
		});

		const { follows } = response.body;
		const who = (!target || context.user.Name === target.toLowerCase())
			? "you"
			: "they";

		if (follows.length === 0) {
			return {
				reply: `${sb.Utils.capitalize(who)} don't have any followers.`
			};
		}
		else {
			const follow = follows[0];
			const followUser = (follow.user.name.toLowerCase() === context.user.Name)
				? "you!"
				: follow.user.name;

			const delta = sb.Utils.timeDelta(new sb.Date(follow.created_at), false, true);
			return {
				reply: `The longest following user ${who} have is ${followUser}, since ${delta}.`
			};
		}
	}),
	Dynamic_Description: (async (prefix) => [
		"Fetches the first still active follower of a provided channel on Twitch.",
		`To fetch the reverse - the first followed channel of a given user - check out the <a href="/bot/command/detail/firstfollowedchannel">first followed channel</a> command`,
		"",

		`<code>${prefix}fcf</code>`,
		`<code>${prefix}firstchannelfollower</code>`,
		"Posts your first still active follower.",
		"",

		`<code>${prefix}fcf (username)</code>`,
		`<code>${prefix}firstchannelfollower (username)</code>`,
		"Posts the provided channel's first still active follower.",
		""
	])
};
