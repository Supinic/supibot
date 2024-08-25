module.exports = {
	Name: "firstfollowedchannel",
	Aliases: ["ffc"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the first channel you or someone else have ever followed on Twitch.",
	Flags: ["mention","non-nullable","opt-out","pipe"],
	Params: null,
	Whitelist_Response: null,
	initialize: function () {
		this.data.requestHeaders = {
			Accept: "*/*",
			"Accept-Language": "en-US",
			"Content-Type": "text/plain;charset=UTF-8",
			Referer: `https://dashboard.twitch.tv/`
		};

		if (process.env.TWITCH_GQL_CLIENT_ID) {
			this.data.requestHeaders["Client-ID"] = process.env.TWITCH_GQL_CLIENT_ID;
		}
		if (process.env.TWITCH_GQL_CLIENT_VERSION) {
			this.data.requestHeaders["Client-Version"] = process.env.TWITCH_GQL_CLIENT_VERSION;
		}
		if (process.env.TWITCH_GQL_DEVICE_ID) {
			this.data.requestHeaders["X-Device-ID"] = process.env.TWITCH_GQL_DEVICE_ID;
		}
	},
	Code: (async function firstFollowedChannel (context, target) {
		if (!this.data.enabled) {
			return {
				success: false,
				reply: "This command is missing configuration!"
			};
		}

		const platform = sb.Platform.get("twitch");
		const name = sb.User.normalizeUsername(target ?? context.user.Name);

		const channelID = await platform.getUserID(name);
		if (!channelID) {
			return {
				success: false,
				reply: "Could not match user to a Twitch user ID!"
			};
		}

		const response = await sb.Got.gql({
			url: "https://gql.twitch.tv/gql",
			responseType: "json",
			headers: this.data.requestHeaders,
			query: `query ChannelFollows{user(login:"${name}"){follows(first:1){edges{node{login}followedAt}}}}`
		});

		if (Array.isArray(response.body.errors) && response.body.errors[0].message === "service error") {
			return {
				success: false,
				cooldown: {
					user: null,
					command: this.Name,
					channel: context.channel?.ID ?? null,
					platform: context.platform.ID,
					length: 60_000
				},
				reply: `Cannot fetch followers! Twitch has disabled, changed or broken the ability to check a channel's followers, which in turn breaks this command.`
			};
		}

		const who = (context.user.Name === name.toLowerCase())
			? "you"
			: "they";

		if (!response.body.data.user) {
			const target = (context.user.Name === name.toLowerCase()) ? "you" : "that user";
			return {
				success: false,
				reply: `No follower data is currently available for ${target}!`
			};
		}

		const { edges } = response.body.data.user.follows;
		if (!edges || edges.length === 0) {
			return {
				reply: `${sb.Utils.capitalize(who)} don't follow anyone.`
			};
		}

		const edge = edges.find(i => i.node);
		if (!edge) {
			return {
				success: false,
				reply: `You seem to have hit a very rare case where all 10 first followers are banned! Congratulations?`
			};
		}

		const date = edge.followedAt;
		const followUsername = edge.node.login;
		const followUser = (followUsername.toLowerCase() === context.user.Name)
			? "you!"
			: `@${followUsername}`;

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
