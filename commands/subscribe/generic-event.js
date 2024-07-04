const { parseRSS } = require("../../utils/command-utils.js");
const DEFAULT_CHANNEL_ID = 38;

const rssFetch = async (url) => await fetch(url, {
	headers: {
		// "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
		// "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/602.1 (KHTML, like Gecko) QuiteRss/0.19.4 Version/10.0 Safari/602.1"
		Accept: "application/xml,text/html,application/xhtml+xml"
	},
	redirect: "follow"
});


/**
 * @typedef {Object} UserSubscription
 * @property {number} ID
 * @property {number|null} Reminder_Channel
 * @property {string} Username
 * @property {Date} Last_Seen
 */

/**
 * @param {string} subType
 * @param {number} [lastSeenThreshold]
 * @returns {Promise<{
 * 	inactiveUsers: UserSubscription[],
 * 	activeUsers: UserSubscription[]
 * 	}>}
 */
const fetchSubscriptionUsers = async function (subType, lastSeenThreshold = 36e5) {
	/** @type {Object[]} */
	const users = await sb.Query.getRecordset(rs => rs
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

	const now = sb.Date.now();
	const [activeUsers, inactiveUsers] = sb.Utils.splitByCondition(users, user => {
		if (now - user.Last_Seen < lastSeenThreshold) {
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

/**
 * @param {UserSubscription[]} users
 * @param {string} message
 * @returns {Promise<Array>}
 */
const createReminders = async function (users, message) {
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

/**
 * @param {string} subType
 * @param {string} message
 * @param {Object} [options]
 * @param {number} [options.lastSeenThreshold]
 * @returns {Promise<void>}
 */
const handleSubscription = async function (subType, message, options = {}) {
	const { activeUsers, inactiveUsers } = await fetchSubscriptionUsers(subType, options.lastSeenThreshold);

	await createReminders(inactiveUsers, message);

	const channelUsers = {};
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
 * Parses RSS xml into a object definition, caching and uncaching it as required.
 * @param {string} xml
 * @param {string} cacheKey
 * @return {Promise<*[]|null>}
 */
const parseRssNews = async function (xml, cacheKey) {
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

/**
 * @typedef {Object} GenericEventDefinition
 * @property {string} cacheKey
 * @property {string} eventName
 * @property {string} url
 * @property {string} subName
 * @property {"rss"|"custom"} type
 * @property {Function} [process]
 */

/**
 * For a given definition of a subscription event, fetches the newest item and handles the subscription if a new is found.
 * @param {GenericEventDefinition} definition
 * @return {Promise<void>}
 */
const handleGenericSubscription = async (definition) => {
	const { cacheKey, name, process, url, subName, type } = definition;

	let message;
	if (type === "rss") {
		const response = await sb.Got("GenericAPI", {
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
		const result = await process(url);
		if (!result || !result.message) {
			return;
		}

		message = result.message;
	}

	await handleSubscription(name, message);
};

module.exports = {
	handleGenericSubscription
};
