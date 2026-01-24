import * as z from "zod";
import { declare } from "../../classes/command.js";
import { ivrUserDataSchema } from "../../utils/schemas.js";
import type { Platform } from "../../platforms/template.js";
import type { User } from "../../classes/user.js";

const getTargetName = (userName: string, user: User, platform: Platform) => {
	if (userName === user.Name) {
		return "You are";
	}
	else if (userName === platform.selfName) {
		return "I am";
	}
	else {
		return `User ${userName} is`;
	}
};

const querySchema = z.array(z.object({
	data: z.object({
		targetUser: z.object({
			relationship: z.object({
				cumulativeTenure: z.object({
					daysRemaining: z.int(),
					months: z.int()
				}).nullable(),
				subscriptionBenefit: z.object({
					gift: z.object({ isGift: z.boolean() }),
					purchasedWithPrime: z.boolean(),
					tier: z.string()
				}).nullable()
			})
		}).nullable()
	})
}));

export default declare({
	Name: "subage",
	Aliases: ["sa"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the subscription data for a given user on a given channel on Twitch.",
	Flags: ["mention", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: async function subAge (context, user?: string, channel?: string) {
		const platform = sb.Platform.getAsserted("twitch");
		const userName = sb.User.normalizeUsername(user ?? context.user.Name);

		const userID = await platform.getUserID(userName);
		if (!userID) {
			return {
				success: false,
				reply: `User ${userName} does not exist on Twitch, or is banned!`
			};
		}

		let channelName = channel;
		if (!channelName) {
			if (context.platform.name !== "twitch") {
				return {
					success: false,
					reply: `When not in a Twitch channel, a specific channel name must be provided!`
				};
			}
			else if (!context.channel) {
				return {
					success: false,
					reply: `When in private messages, a specific channel name must be provided!`
				};
			}

			channelName = context.channel.Name;
		}

		const channelID = await platform.getUserID(sb.User.normalizeUsername(channelName));
		if (!channelID) {
			return {
				success: false,
				reply: `Channel ${userName} does not exist on Twitch, or is banned!`
			};
		}

		const response = await core.Got.get("TwitchGQL")({
			responseType: "json",
			headers: {
				Referer: `https://www.twitch.tv/popout/${channelName}/viewercard/${userName}`
			},
			body: JSON.stringify([{
				operationName: "ViewerCard",
				extensions: {
					persistedQuery: {
						version: 1,
						sha256Hash: "80c53fe04c79a6414484104ea573c28d6a8436e031a235fc6908de63f51c74fd"
					}
				},
				variables: {
					channelID,
					channelLogin: channelName,
					badgeSourceChannelID: channelID,
					badgeSourceChannelLogin: channelName,
					giftRecipientLogin: userName,
					hasChannelID: true,
					isViewerBadgeCollectionEnabled: true,
					withStandardGifting: true
				}
			}])
		});

		const sub = querySchema.parse(response.body).at(0);
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
			// No tenure -> either the target channel isn't affiliated, is banned, or is hiding subscription status
			const response = await core.Got.get("IVR")({
				url: "v2/twitch/user",
				searchParams: { login: channelName }
			});

			const channelNameString = getTargetName(channelName, context.user, context.platform);
			if (response.statusCode === 200 && response.body.length !== 0) {
				const [channelInfo] = ivrUserDataSchema.parse(response.body);
				const { banned } = channelInfo;
				const { isAffiliate, isPartner } = channelInfo.roles;

				if (!isAffiliate && !isPartner) {
					return {
						success: false,
						reply: `${channelNameString} not affiliated nor partnered!`
					};
				}
				else if (banned) {
					const { banReason } = channelInfo;
					return {
						success: false,
						reply: `${channelNameString} currently banned (${banReason})!`
					};
				}
			}

			return {
				success: false,
				reply: `You are currently hiding subscription statuses!`
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

		const userString = getTargetName(userName, context.user, context.platform);
		const { daysRemaining, months } = relationship.cumulativeTenure;
		if (!relationship.subscriptionBenefit) {
			if (daysRemaining === 0 && months === 0) {
				const verb = (userString.startsWith("User")) ? "has" : "have";
				return {
					success: true,
					reply: `${userString} not subscribed to ${channelString}, and never ${verb} been.`
				};
			}
			else {
				return {
					success: true,
					reply: `${userString} not subscribed to ${channelString}, but used to be subscribed for ${months} months.`
				};
			}
		}

		const benefit = relationship.subscriptionBenefit;
		const giftString = (benefit.gift.isGift) ? "gifted" : "";
		const primeString = (benefit.purchasedWithPrime) ? "Prime" : "";
		const tier = benefit.tier.replace("000", "");
		const remainingString = (daysRemaining === 0)
			? "less than 24 hours"
			: `${daysRemaining} days`;

		return {
			reply: core.Utils.tag.trim `
				${userString} subscribed to ${channelString}
				for ${months} months in total
				with a Tier ${tier} ${giftString} ${primeString} subscription.
				Next Sub anniversary: in ${remainingString}.
			`
		};
	},
	Dynamic_Description: (prefix) => [
		"Shows the current subscription status for you or someone else to the current channel or any other provided.",
		"",

		`<code>${prefix}subage</code>`,
		`<code>${prefix}sa</code>`,
		"Shows your current subscription status to the channel you're using this command in.",
		"Won't work in whispers if used like this - there's no channel to default to.",
		"",

		`<code>${prefix}subage (user)</code>`,
		"Shows that user's current subscription status to the channel you're using this command in.",
		"Again, won't work in whispers",
		"",

		`<code>${prefix}subage (user) (channel)</code>`,
		"Shows that user's current subscription status to the channel you provided.",
		"Will work in whispers as well, since you provided the channel specifically."
	]
});
