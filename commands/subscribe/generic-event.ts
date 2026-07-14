import { Date as SupiDate, type Row } from "supi-core";
import { parseRSS } from "../../utils/command-utils.js";
import type { User } from "../../classes/user.js";
import type { Channel } from "../../classes/channel.js";
import type { Platform } from "../../platforms/template.js";
import type { SubscribeCommandContext } from "./index.js";

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

const fetchSubscriptionUsers = async function (subscriptionType: SubscriptionType, lastSeenThreshold = 36e5): Promise<FetchUsersResult> {
	const users = await core.Query.getRecordset<UserSubscription[]>(rs => rs
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
		.where("Type = %s", subscriptionType)
		.where("Active = %b", true)
	);

	const now: number = SupiDate.now();
	const [activeUsers, inactiveUsers] = core.Utils.splitByCondition(users, (user: UserSubscription): boolean => {
		const lastSeen = now - user.Last_Seen.valueOf();
		if (lastSeen < lastSeenThreshold) {
			return true;
		}

		const flags = JSON.parse(user.Flags ?? "{}") as { skipPrivateReminder?: boolean; };
		return (flags.skipPrivateReminder === true);
	});

	return {
		activeUsers,
		inactiveUsers
	};
};

const createReminders = async function (users: UserSubscription[], message: string) {
	return await Promise.all(users.map(user => (
		sb.Reminder.create({
			Channel: null,
			User_From: null,
			User_To: user.ID,
			Text: `${message} (you were not around when it was announced)`,
			Schedule: null,
			Private_Message: true,
			Platform: 1,
			Type: "Reminder",
			Created: new SupiDate()
		}, true)
	)));
};

type HandleOptions = { lastSeenThreshold?: number; };

const sendChannelSubscriptionMessage = async (message: string, channelID: number, userDataList: UserSubscription[]): Promise<void> => {
	const channelData = sb.Channel.get(channelID);
	if (!channelData) {
		return;
	}

	const threshold = new SupiDate().addMonths(-3);
	const longInactiveUsers = await core.Query.getRecordset<number[]>(rs => rs
		.select("User_Alias")
		.from("chat_data", "Message_Meta_User_Alias")
		.where("Channel = %n", channelID)
		.where("User_Alias IN %n+", userDataList.map(i => i.ID))
		.where("Last_Message_Posted < %d", threshold)
		.flat("User_Alias")
	);

	const chatPing = userDataList
		.filter(i => !longInactiveUsers.includes(i.ID))
		.map(i => `@${i.Username}`);

	if (chatPing.length === 0) {
		return;
	}

	await channelData.send(`${chatPing.join(" ")} ${message}`);
};

export const handleEventSubscription = async function (subscriptionType: SubscriptionType, message: string, options: HandleOptions = {}) {
	const { activeUsers, inactiveUsers } = await fetchSubscriptionUsers(subscriptionType, options.lastSeenThreshold);

	await createReminders(inactiveUsers, message);

	const channelUsers: Map<number, UserSubscription[]> = new Map();
	for (const user of [...activeUsers, ...inactiveUsers]) {
		const channelID = user.Reminder_Channel ?? DEFAULT_CHANNEL_ID;

		let userArray = channelUsers.get(channelID);
		if (!userArray) {
			userArray = [];
			channelUsers.set(channelID, userArray);
		}

		userArray.push(user);
	}

	const promises = [];
	for (const [channelID, userDataList] of channelUsers) {
		const promise = sendChannelSubscriptionMessage(message, channelID, userDataList);
		promises.push(promise);
	}

	await Promise.allSettled(promises);
};

type WeirdRssCategory = { _: string; $: Record<string, string> };
type Category = string | WeirdRssCategory;

/**
 * Parses RSS XML into an object definition, caching and uncaching it as required.
 */
const parseRssNews = async function (xml: string, cacheKey: string, options: RssEventDefinition["options"] = {}): Promise<string[] | null> {
	const feed = await parseRSS(xml);
	const lastPublishDate = (await core.Cache.getByPrefix(cacheKey) ?? 0) as number;

	const { ignoredCategories } = options;
	const eligibleArticles = feed.items
		.filter(article => new SupiDate(article.pubDate).valueOf() > lastPublishDate)
		.filter(article => {
			if (!ignoredCategories) {
				return true;
			}

			const categories = (article.categories ?? []) as Category[];
			return categories.every(cat => {
				const category = (typeof cat === "string") ? cat : cat._;
				return !ignoredCategories.includes(category.toLowerCase());
			});
		})
		.sort((a, b) => new SupiDate(b.pubDate).valueOf() - new SupiDate(a.pubDate).valueOf());

	if (eligibleArticles.length === 0) {
		return null;
	}

	const [topArticle] = eligibleArticles;

	// No expiry date - prevents hibernated feeds from skipping their next update later on (used to be 7 days)
	await core.Cache.setByPrefix(cacheKey, new SupiDate(topArticle.pubDate).valueOf());

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

export type EventSubscription = {
	ID: number;
	User_Alias: User["ID"];
	Channel: Channel["ID"] | null;
	Platform: Platform["ID"];
	Type: string;
	Data: string | null;
	Flags: string;
	Active: boolean;
};

type BaseEventDefinition = {
	type: "rss" | "custom" | "special";
	title: string;
	names: string[];
	notes?: string;
	channelSpecificMention?: boolean;
};

type SpecialBaseEventDefinition = BaseEventDefinition & {
	type: "special";
	notes: string;
};
type SpecialHandlerEventDefinition = SpecialBaseEventDefinition & {
	handler: (context: SubscribeCommandContext, subscription: Row<EventSubscription>, ...args: string[]) => Promise<CommandResult>;
};
type SpecialResponseEventDefinition = SpecialBaseEventDefinition & {
	response: {
		added: string;
		removed: string;
	};
};
export type SpecialEventDefinition = SpecialHandlerEventDefinition | SpecialResponseEventDefinition;
export type RssEventDefinition = BaseEventDefinition & {
	type: "rss";
	url: string;
	emote?: string;
	cronExpression?: string;
	item?: string;
	options?: {
		// Always lowercase due to zod validation
		ignoredCategories?: string[];
	};
};
export type CustomEventDefinition = BaseEventDefinition & {
	type: "custom";
	process: () => Promise<null | { message: string }>;
	cronExpression?: string;
	response?: {
		added: string;
		removed: string;
	};
};
export type GenericEventDefinition = RssEventDefinition | CustomEventDefinition;

export type EventDefinition = RssEventDefinition | CustomEventDefinition | SpecialEventDefinition;

export const isGenericSubscriptionDefinition = (input: EventDefinition): input is GenericEventDefinition => (input.type === "rss" || input.type === "custom");

const makeGenericCacheKey = (name: string) => `${name.toLowerCase().replaceAll(/\s+/g, "-")}-last-publish-date`;

/**
 * For a given definition of a subscription event, fetches the newest item and handles the subscription if a new is found.
 */
export const handleGenericSubscription = async (definition: GenericEventDefinition) => {
	const { title, type } = definition;

	let message;
	if (type === "rss") {
		const { options, item = "article", url, emote = "PagChomp" } = definition;
		const cacheKey = makeGenericCacheKey(title);

		const response = await core.Got.get("GenericAPI")({
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

		const result = await parseRssNews(response.body, cacheKey, options);
		if (!result) {
			return;
		}

		const suffix = (result.length === 1) ? "" : "s";
		message = `New ${item}${suffix}! ${emote} 👉 ${result.join(" -- ")}`;
	}
	else {
		const { process } = definition;
		const result = await process();
		if (!result || !result.message) {
			return;
		}

		message = result.message;
	}

	await handleEventSubscription(title, message);
};
