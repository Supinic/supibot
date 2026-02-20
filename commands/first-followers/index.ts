import * as z from "zod";
import { SupiDate } from "supi-core";
import { declare } from "../../classes/command.js";
import type { User } from "../../classes/user.js";

const edgesShape = z.array(z.object({
	followedAt: z.iso.datetime(),
	node: z.object({ login: z.string() }).optional()
})).optional();

type Edges = z.infer<typeof edgesShape>;
const parseEdges = (user: User, name: string, edges: Edges, type: "channelFollower" | "followedChannel") => {
	const who = (user.Name === name.toLowerCase()) ? "you" : "they";
	if (!edges || edges.length === 0) {
		return {
			success: true,
			reply: (type === "channelFollower")
				? `${core.Utils.capitalize(who)} don't follow anyone.`
				: `${core.Utils.capitalize(who)} don't have any followers.`
		};
	}

	const edge = edges.find(i => i.node);
	if (!edge || !edge.node) {
		return {
			success: false,
			reply: `You seem to have hit a very rare case where all of the 10 first followers I checked are banned! Congratulations?`
		};
	}

	const date = edge.followedAt;
	const followUsername = edge.node.login;
	const followUser = (followUsername.toLowerCase() === user.Name)
		? "you!"
		: `@${followUsername}`;

	const delta = core.Utils.timeDelta(new SupiDate(date), false, true);
	return {
		success: true,
		reply: (type === "channelFollower")
			? `The longest still following user ${who} have is ${followUser}, since ${delta}.`
			: `The channel ${who} have followed the longest is ${followUser}, since ${delta}.`
	};
};

const channelFollowerSchema = z.object({
	data: z.object({
		user: z.object({ followers: z.object({ edges: edgesShape }) }).optional()
	}),
	errors: z.array(z.object({ message: z.string() })).optional()
});
const followedChannelSchema = z.object({
	data: z.object({
		user: z.object({ follows: z.object({ edges: edgesShape }) }).optional()
	}),
	errors: z.array(z.object({ message: z.string() })).optional()
});

const extraHeaders: [string, string][] = [];
if (process.env.TWITCH_GQL_CLIENT_ID) {
	extraHeaders.push(["Client-ID", process.env.TWITCH_GQL_CLIENT_ID]);
}
if (process.env.TWITCH_GQL_CLIENT_VERSION) {
	extraHeaders.push(["Client-Version", process.env.TWITCH_GQL_CLIENT_VERSION]);
}
if (process.env.TWITCH_GQL_DEVICE_ID) {
	extraHeaders.push(["X-Device-ID", process.env.TWITCH_GQL_DEVICE_ID]);
}

const headers = new Map([
	["Accept", "*/*"],
	["Accept-Language", "en-US"],
	["Content-Type", "text/plain;charset=UTF-8"],
	["Referer", "https://dashboard.twitch.tv/"],
	...extraHeaders
]);

export const FirstChannelFollowerCommand = declare({
	Name: "firstchannelfollower",
	Aliases: ["fcf"],
	Cooldown: 10_000,
	Description: "Fetches the first user that follows you or someone else on Twitch.",
	Flags: ["mention", "non-nullable", "opt-out", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function firstChannelFollower (context, target?: string) {
		const platform = sb.Platform.getAsserted("twitch");
		const name = sb.User.normalizeUsername(target ?? context.user.Name);

		const channelID = await platform.getUserID(name);
		if (!channelID) {
			return {
				success: false,
				reply: "Could not match user to a Twitch user ID!"
			};
		}

		const response = await core.Got.gql({
			url: "https://gql.twitch.tv/gql",
			headers: Object.fromEntries(headers.entries()),
			query: `{user(login:"${name}"){followers(first:1){edges{node{login}followedAt}}}}`
		});

		const { user } = channelFollowerSchema.parse(response.body).data;
		if (!user) {
			const target = (context.user.Name === name.toLowerCase()) ? "you" : "that user";
			return {
				success: false,
				reply: `No follower data is currently available for ${target}!`
			};
		}

		const result = parseEdges(context.user, name, user.followers.edges, "channelFollower");
		return result;
	}),
	Dynamic_Description: (prefix) => [
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
	]
});

export const FirstFollowedChannelCommand = declare({
	Name: "firstfollowedchannel",
	Aliases: ["ffc"],
	Cooldown: 10000,
	Description: "Fetches the first channel you or someone else have ever followed on Twitch.",
	Flags: ["mention","non-nullable","opt-out","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function firstFollowedChannel (context, target?: string) {
		const platform = sb.Platform.getAsserted("twitch");
		const name = sb.User.normalizeUsername(target ?? context.user.Name);
		const channelID = await platform.getUserID(name);
		if (!channelID) {
			return {
				success: false,
				reply: "Could not match user to a Twitch user ID!"
			};
		}

		const response = await core.Got.gql({
			url: "https://gql.twitch.tv/gql",
			headers: Object.fromEntries(headers.entries()),
			query: `query ChannelFollows{user(login:"${name}"){follows(first:1){edges{node{login}followedAt}}}}`
		});

		const rawData = followedChannelSchema.parse(response.body);
		if (Array.isArray(rawData.errors) && rawData.errors[0].message === "service error") {
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

		const { user } = rawData.data;
		if (!user) {
			const target = (context.user.Name === name.toLowerCase()) ? "you" : "that user";
			return {
				success: false,
				reply: `No follower data is currently available for ${target}!`
			};
		}

		const result = parseEdges(context.user, name, user.follows.edges, "followedChannel");
		return result;
	}),
	Dynamic_Description: (prefix) => [
		"Fetches the first channel the provided user (or you) have ever followed on Twitch",
		`To fetch the reverse - the first follower of a given channel - check out the <a href="/bot/command/detail/firstchannelfollower">first channel follower</a> command`,
		"",

		`<code>${prefix}ffc</code>`,
		`<code>${prefix}firstfollowedchannel</code>`,
		"Posts your first ever followed channel that's still active.",
		"",

		`<code>${prefix}ffc (username)</code>`,
		`<code>${prefix}firstfollowedchannel (username)</code>`,
		"Posts target user's first ever followed channel that's still active."
	]
});
