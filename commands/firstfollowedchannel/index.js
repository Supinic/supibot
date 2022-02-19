module.exports = {
	Name: "firstfollowedchannel",
	Aliases: ["ffc"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the first channel you or someone else have ever followed on Twitch.",
	Flags: ["mention","non-nullable","opt-out","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function firstFollowedChannel (context, target) {
		const { controller } = sb.Platform.get("twitch");
		const name = target ?? context.user.Name;
		const channelID = await controller.getUserID(name);
		if (!channelID) {
			return {
				success: false,
				reply: "Could not match user to a Twitch user ID!"
			};
		}

		const response = await sb.Got.gql({
			url: "https://gql.twitch.tv/gql",
			responseType: "json",
			headers: {
				Accept: "*/*",
				"Accept-Language": "en-US",
				Authorization: `OAuth ${sb.Config.get("TWITCH_GQL_OAUTH")}`,
				"Client-ID": sb.Config.get("TWITCH_GQL_CLIENT_ID"),
				"Client-Version": sb.Config.get("TWITCH_GQL_CLIENT_VERSION"),
				"Content-Type": "text/plain;charset=UTF-8",
				Referer: `https://dashboard.twitch.tv/`,
				"X-Device-ID": sb.Config.get("TWITCH_GQL_DEVICE_ID")
			},
			query: ` 
				query {
					user(login: "${name}") {
						follows(order: ASC, first: 1) {
							edges {
								followedAt
								node {
									login
								}
							}
						}
					}
				}`
		});

		const who = (context.user.Name === name.toLowerCase())
			? "you"
			: "they";

		if (!response.body.data.user.follows) {
			return {
				success: false,
				reply: `${sb.Utils.capitalize(who)} are currently banned!`
			};
		}

		const { edges } = response.body.data.user.follows;
		if (edges.length === 0) {
			return {
				reply: `${sb.Utils.capitalize(who)} don't follow anyone.`
			};
		}

		const date = edges[0].followedAt;
		const followUsername = edges[0].node.login;
		const followUser = (followUsername.toLowerCase() === context.user.Name)
			? "you!"
			: followUsername;

		const delta = sb.Utils.timeDelta(new sb.Date(date), false, true);
		return {
			reply: `The channel ${who} have followed the longest is ${followUser}, since ${delta}.`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Fetches the first channel the provided user (or you) have ever followed on Twitch",
		`To fetch the reverse - the first follower of a given channel - check out the <a href="/bot/command/detail/firstchannelfollower">first channel follower</a> command`,
		"",

		`<code>${prefix}ffc</code>`,
		`<code>${prefix}firstfollowedchannel</code>`,
		"Posts your first ever followed channel that's still active.",
		"",

		`<code>${prefix}ffc (username)</code>`,
		`<code>${prefix}firstfollowedchannel (username)</code>`,
		"Posts target user's first ever followed channel that's still active.",
		""
	])
};
