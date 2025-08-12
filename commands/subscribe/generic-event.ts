import { type Context } from "../../classes/command.js";
import { Date as SupiDate, type Row } from "supi-core";
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
		.where("Type = %s", subType)
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
			User_From: 1127,
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

const handleSubscription = async function (subType: SubscriptionType, message: string, options: HandleOptions = {}) {
	const { activeUsers, inactiveUsers } = await fetchSubscriptionUsers(subType, options.lastSeenThreshold);

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

	for (const [channelID, userDataList] of channelUsers.entries()) {
		const chatPing = userDataList.map(i => `@${i.Username}`).join(" ");
		const channelData = sb.Channel.get(channelID);
		if (!channelData) {
			continue;
		}

		await channelData.send(`${chatPing} ${message}`);
	}
};

/**
 * Parses RSS xml into an object definition, caching and uncaching it as required.
 */
const parseRssNews = async function (xml: string, cacheKey: string, options: RssEventDefinition["options"] = {}): Promise<string[] | null> {
	const feed = await parseRSS(xml);
	const lastPublishDate = (await core.Cache.getByPrefix(cacheKey) ?? 0) as number;

	const skippedCategories = (options.ignoredCategories ?? []).map(i => i.toLowerCase());
	const eligibleArticles = feed.items
		.filter(article => new SupiDate(article.pubDate).valueOf() > lastPublishDate)
		.filter(article => {
			if (skippedCategories.length === 0) {
				return true;
			}

			const itemCat = (article.categories ?? []).map(i => i.toLowerCase());
			return itemCat.some(category => skippedCategories.includes(category));
		})
		.sort((a, b) => new SupiDate(b.pubDate).valueOf() - new SupiDate(a.pubDate).valueOf());

	if (eligibleArticles.length === 0) {
		return null;
	}

	const [topArticle] = eligibleArticles;
	await core.Cache.setByPrefix(cacheKey, new SupiDate(topArticle.pubDate).valueOf(), {
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
	// @todo perhaps specify the Context by typing it with the $subscribe command params?
	handler?: (context: Context, subscription: Row<UserSubscription>, ...args: string[]) => Promise<CommandResult>;
};

export type RssEventDefinition = BaseEventDefinition & {
	type: "rss";
	url: string;
	cacheKey: string;
	options?: {
		ignoredCategories?: string[];
	};
};
export type CustomEventDefinition = BaseEventDefinition & {
	type: "custom";
	process: () => Promise<null | { message: string }>;
};
export type GenericEventDefinition = RssEventDefinition | CustomEventDefinition;

/**
 * For a given definition of a subscription event, fetches the newest item and handles the subscription if a new is found.
 */
export const handleGenericSubscription = async (definition: GenericEventDefinition) => {
	const { name, subName, type } = definition;

	let message;
	if (type === "rss") {
		const { cacheKey, options, url } = definition;
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
