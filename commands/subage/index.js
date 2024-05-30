const getTargetName = (userName, context) => {
	if (userName === context.user.Name) {
		return "You are";
	}
	else if (userName === context.platform.Self_Name) {
		return "I am";
	}
	else {
		return `User ${userName} is`;
	}
};

module.exports = {
	Name: "subage",
	Aliases: ["sa"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the subscription data for a given user on a given channel on Twitch.",
	Flags: ["mention"],
	Params: null,
	Whitelist_Response: null,
	Code: async function subAge (context, user, channel) {
		const platform = sb.Platform.get("twitch");
		const userID = await platform.getUserID(user ?? context.user.Name);
		if (!userID) {
			return {
				success: false,
				reply: `Provided user does not exist on Twitch!`
			};
		}

		let channelID;
		if (channel) {
			channelID = await platform.getUserID(channel);
		}
		else {
			if (context.platform.Name !== "twitch") {
				return {
					success: false,
					reply: `When not in a Twitch channel, a specific channel name must be provided!`
				};
			}
			else if (context.privateMessage) {
				return {
					success: false,
					reply: `When in private messages, a specific channel name must be provided!`
				};
			}

			channelID = await platform.getUserID(context.channel.Name);
		}

		if (!channelID) {
			return {
				success: false,
				reply: `Provided channel does not exist on Twitch!`
			};
		}

		const channelName = sb.User.normalizeUsername(channel ?? context.channel.Name);
		const userName = sb.User.normalizeUsername(user ?? context.user.Name);

		const response = await sb.Got("FakeAgent", {
			method: "POST",
			url: "https://gql.twitch.tv/gql",
			responseType: "json",
			headers: {
				Accept: "*/*",
				"Accept-Language": "en-US",
				Authorization: `OAuth ${sb.Config.get("TWITCH_GQL_OAUTH")}`,
				"Client-ID": sb.Config.get("TWITCH_GQL_CLIENT_ID"),
				"Client-Version": sb.Config.get("TWITCH_GQL_CLIENT_VERSION"),
				"Content-Type": "text/plain;charset=UTF-8",
				Referer: `https://www.twitch.tv/popout/${channelName}/viewercard/${userName}`,
				"X-Device-ID": sb.Config.get("TWITCH_GQL_DEVICE_ID")
			},
			body: JSON.stringify([{
				operationName: "ViewerCard",
				extensions: {
					persistedQuery: {
						version: 1,
						sha256Hash: "823772cac91efa0a24f86a80463f37f0377cb216d7ce57a4ab90b61d1e01de8b"
					}
				},
				variables: {
					channelID,
					channelLogin: channelName,
					giftRecipientLogin: userName,
					hasChannelID: true,
					isViewerBadgeCollectionEnabled: true,
					withStandardGifting: true
				}
			}])
		});

		const [sub] = response.body;
		if (!sub) {
			return {
				success: false,
				reply: `No subscription data available!`
			};
		}
		else if (!sub.data.targetUser) {
			return {
				success: false,
				reply: `Target user does not exist!`
			};
		}

		const { relationship } = sub.data.targetUser;
		if (!relationship.cumulativeTenure) {
			const response = await sb.Got("IVR", {
				url: "v2/twitch/user",
				searchParams: {
					login: channelName
				}
			});

			const channelNameString = getTargetName(channelName, context);
			if (response.statusCode === 200 && response.body.length !== 0) {
				const [channelInfo] = response.body;
				const { banned, banReason } = channelInfo;
				const { isAffiliate, isPartner } = channelInfo.roles ?? {};

				if (isAffiliate === false && isPartner === false) {
					return {
						success: false,
						reply: `${channelNameString} not affiliated nor partnered!`
					};
				}
				else if (banned === true) {
					return {
						success: false,
						reply: `${channelNameString} currently banned (${banReason})!`
					};
				}
			}

			return {
				success: false,
				reply: `${channelNameString} currently hiding subscription statuses!`
			};
		}

		let channelString;
		if (channelName === context.user.Name && userName === channelName) {
			channelString = "yourself";
		}
		else if (channelName === context.platform.Self_Name && userName === channelName) {
			channelString = "myself";
		}
		else if (channelName === context.user.Name) {
			channelString = "you";
		}
		else if (channelName === context.platform.Self_Name) {
			channelString = "me";
		}
		else {
			channelString = channelName;
		}

		const userString = getTargetName(userName, context);
		const { daysRemaining, months } = relationship.cumulativeTenure;
		if (!relationship.subscriptionBenefit) {
			if (daysRemaining === 0 && months === 0) {
				return {
					reply: `${userString} not subscribed to ${channelString}, and never been before.`
				};
			}
			else {
				return {
					reply: `${userString} not subscribed to ${channelString}, but used to be subscribed for ${months} months.`
				};
			}
		}
		else {
			const benefit = relationship.subscriptionBenefit;
			const giftString = (benefit.gift.isGift) ? "gifted" : "";
			const primeString = (benefit.purchasedWithPrime) ? "Prime" : "";
			const tier = benefit.tier.replace("000", "");
			const remainingString = (daysRemaining === 0)
				? "less than 24 hours"
				: `${daysRemaining} days`;

			return {
				reply: sb.Utils.tag.trim `
					${userString} subscribed to ${channelString}
					for ${months} months in total
					with a Tier ${tier} ${giftString} ${primeString} subscription.
					Next Sub anniversary: in ${remainingString}.
				`
			};
		}
	},
	Dynamic_Description: () => ([
		"Shows the current subscription status for you or someone else to the current channel or any other provided.",
		"",

		`<code>$subage</code>`,
		`<code>$sa</code>`,
		"Shows your current subscription status to the channel you're using this command in.",
		"Obviously, if used like this, will not work in whispers.",
		"",

		`<code>$subage (user)</code>`,
		"Shows that user's current subscription status to the channel you're using this command in.",
		"Again, won't work in whispers",
		"",

		`<code>$subage (user) (channel)</code>`,
		"Shows that user's current subscription status to the channel you provided.",
		"Will work in whispers as well, since you provided the channel specifically."
	])
};
