// import { type Recordset } from "supi-core";
import { Date as SupiDate } from "supi-core";
type Recordset = any; // @todo uncomment above lines when supi-core exports refactor is finished

import { parseRSS } from "../../utils/command-utils.js";

const DEFAULT_CHANNEL_ID = 38;

type SubscriptionType = string;
type UserSubscription = {
	ID: number;
	Reminder_Channel: number | null;
	Username: string;
	Last_Seen: SupiDate;
	Flags: string | null;
};

type FetchUsersResult = {
	activeUsers: UserSubscription[];
	inactiveUsers: UserSubscription[];
};

const fetchSubscriptionUsers = async function (subType: SubscriptionType, lastSeenThreshold = 36e5): Promise<FetchUsersResult> {
	const users = await sb.Query.getRecordset((rs: Recordset) => rs
		.select("Event_Subscription.Channel as Reminder_Channel")
		.select("Event_Subscription.User_Alias AS ID")
		.select("Event_Subscription.Flags AS Flags")
		.select("User_Alias.Name AS Username")
		.select("MAX(Meta.Last_Message_Posted) AS Last_Seen")
		.from("data", "Event_Subscription")
		.join("chat_data", "User_Alias")
		.join({
			toDatabase: "chat_data",
			toTable: "Message_Meta_User_Alias",
			alias: "Meta",
			on: "Event_Subscription.User_Alias = Meta.User_Alias"
		})
		.groupBy("Meta.User_Alias")
		.where("Type = %s", subType)
		.where("Active = %b", true)
	) as UserSubscription[];

	const now: number = sb.Date.now();
	const [activeUsers, inactiveUsers] = sb.Utils.splitByCondition(users, (user: UserSubscription): boolean => {
		const lastSeen = now - user.Last_Seen.valueOf();
		if (lastSeen < lastSeenThreshold) {
			return true;
		}

		const flags = JSON.parse(user.Flags ?? "{}");
		return (flags.skipPrivateReminder === true);
	});

	return {
		activeUsers,
		inactiveUsers
	};
};

// @todo remove when Reminder is well-known
type ReminderCreateResult = {
	success: boolean;
	cause: string | null;
	ID?: number;
};

const createReminders = async function (users: UserSubscription[], message: string): Promise<ReminderCreateResult[]> {
	return await Promise.all(users.map(user => (
		sb.Reminder.create({
			Channel: null,
			User_From: 1127,
			User_To: user.ID,
			Text: `${message} (you were not around when it was announced)`,
			Schedule: null,
			Private_Message: true,
			Platform: 1
		}, true)
	)));
};

type HandleOptions = { lastSeenThreshold?: number; };

const handleSubscription = async function (subType: SubscriptionType, message: string, options: HandleOptions = {}) {
	const { activeUsers, inactiveUsers } = await fetchSubscriptionUsers(subType, options.lastSeenThreshold);

	await createReminders(inactiveUsers, message);

	const channelUsers: Record<string, UserSubscription[]> = {};
	for (const user of [...activeUsers, ...inactiveUsers]) {
		const channelID = user.Reminder_Channel ?? DEFAULT_CHANNEL_ID;
		channelUsers[channelID] ??= [];
		channelUsers[channelID].push(user);
	}

	for (const [channelID, userDataList] of Object.entries(channelUsers)) {
		const chatPing = userDataList.map(i => `@${i.Username}`).join(" ");
		const channelData = sb.Channel.get(Number(channelID));

		await channelData.send(`${chatPing} ${message}`);
	}
};

/**
 * Parses RSS xml into an object definition, caching and uncaching it as required.
 */
const parseRssNews = async function (xml: string, cacheKey: string): Promise<string[] | null> {
	const feed = await parseRSS(xml);
	const lastPublishDate = await sb.Cache.getByPrefix(cacheKey) ?? 0;
	const eligibleArticles = feed.items
		.filter(i => new sb.Date(i.pubDate) > lastPublishDate)
		.sort((a, b) => new sb.Date(b.pubDate) - new sb.Date(a.pubDate));

	if (eligibleArticles.length === 0) {
		return null;
	}

	const [topArticle] = eligibleArticles;
	await sb.Cache.setByPrefix(cacheKey, new sb.Date(topArticle.pubDate).valueOf(), {
		expiry: 7 * 864e5 // 7 days
	});

	// Skip posting too many articles if it's the first time running
	if (eligibleArticles.length > 1 && lastPublishDate === 0) {
		return null;
	}

	const result = [];
	for (const article of eligibleArticles) {
		const { link, title } = article;
		result.push(`${title} ${link}`);
	}

	return result;
};

type CommandResult = { // @todo import from Command when supi-core has type exports
	success: boolean;
	reply: string;
};

type BaseEventDefinition = {
	type: "rss" | "custom";
	name: string;
	subName: string;
	aliases: string[];
	notes: string;
	channelSpecificMention?: boolean;
	response: {
		added: string;
		removed: string;
	};
	generic: boolean;
	cronExpression: string;
};
export type SpecialEventDefinition = {
	name: string;
	aliases: string[];
	notes: string;
	channelSpecificMention: boolean;
	response?: {
		added: string;
		removed: string;
	};
	// @todo change context to Context and subscription to Row after supi-core exports types
	handler?: (context: any, subscription: any, ...args: string[]) => Promise<CommandResult>;
};
export type RssEventDefinition = BaseEventDefinition & {
	type: "rss";
	url: string;
	cacheKey: string;
};
export type CustomEventDefinition = BaseEventDefinition & {
	type: "custom";
	process: () => Promise<void | { message: string }>;
};
export type GenericEventDefinition = RssEventDefinition | CustomEventDefinition;

/**
 * For a given definition of a subscription event, fetches the newest item and handles the subscription if a new is found.
 */
export const handleGenericSubscription = async (definition: GenericEventDefinition) => {
	const { name, subName, type } = definition;

	let message;
	if (type === "rss") {
		const { cacheKey, url } = definition;
		const response = await sb.Got.get("GenericAPI")({
			url,
			responseType: "text",
			timeout: {
				request: 10_000
			},
			retry: {
				limit: 5,
				errorCodes: ["ETIMEDOUT", "ECONNREFUSED", "ECONNRESET"]
			}
		});

		if (!response.ok) {
			return;
		}

		const result = await parseRssNews(response.body, cacheKey);
		if (!result) {
			return;
		}

		const suffix = (result.length === 1) ? "" : "s";
		message = `New ${subName}${suffix}! PagChomp 👉 ${result.join(" -- ")}`;
	}
	else {
		const { process } = definition;
		const result = await process();
		if (!result || !result.message) {
			return;
		}

		message = result.message;
	}

	await handleSubscription(name, message);
};
