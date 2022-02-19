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
						followers(order: ASC, first: 1) {
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

		if (!response.body.data.user.followers) {
			return {
				success: false,
				reply: `${sb.Utils.capitalize(who)} are currently banned!`
			};
		}

		const { edges } = response.body.data.user.followers;
		if (!edges || edges.length === 0) {
			return {
				reply: `${sb.Utils.capitalize(who)} don't have any followers.`
			};
		}

		const date = edges[0].followedAt;
		const followUsername = edges[0].node.login;
		const followUser = (followUsername.toLowerCase() === context.user.Name)
			? "you!"
			: followUsername;

		const delta = sb.Utils.timeDelta(new sb.Date(date), false, true);
		return {
			reply: `The longest still following user ${who} have is ${followUser}, since ${delta}.`
		};
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
