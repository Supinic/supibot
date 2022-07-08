module.exports = {
	Name: "channelfounderlist",
	Aliases: ["cfl", "founders"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Shows the list of founders for the specified (or current) channel. Does not \"ping\" the users in chat.",
	Flags: ["mention"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function channelFounderList (context, channelName) {
		if (!channelName && context.platform.Name !== "twitch") {
			return {
				success: false,
				reply: `When not on Twitch, you must provide the channel name!`
			};
		}

		const channel = encodeURIComponent(channelName ?? context.channel.Name);
		const response = await sb.Got("Leppunen", `v2/twitch/founders/${channel}`);
		if (response.statusCode === 404) {
			return {
				success: false,
				reply: `There is no such channel with that name!`
			};
		}

		const foundersString = response.body.founders.map(i => {
			const date = new sb.Date(i.entitlementStart);
			const unpingedLogin = `${i.login[0]}\u{E0000}${i.login.slice(1)}`;

			return `${unpingedLogin} (${date.format("Y-m-d")})`;
		}).join("; ");

		return {
			reply: foundersString
		};
	}),
	Dynamic_Description: null
};
