const ChatGptConfig = require("./config.json");
const createCacheKey = (id) => `gpt-token-usage-user-${id}`;

// Cull the sorted Redis set from values that are too old to keep track of
const removeRedundantSortedListValues = async (cacheKey) => {
	const yesterday = new sb.Date().addDays(-1).valueOf();
	await sb.Cache.server.zremrangebyscore(cacheKey, 0, yesterday);
};

const getTokenUsage = async (userData) => {
	const cacheKey = createCacheKey(userData.ID);
	await removeRedundantSortedListValues(cacheKey);

	const now = sb.Date.now();
	const lastHour = new sb.Date().addHours(-1).valueOf();
	const yesterday = new sb.Date().addDays(-1).valueOf();
	const rawCacheData = await sb.Cache.server.zrange(cacheKey, yesterday, now);

	// Retrieve the cached values along with their timestamps
	let hourlyTokens = 0;
	let dailyTokens = 0;
	const summary = {};

	for (let i = 0; i < rawCacheData.length; i += 2) {
		const timestamp = Number(rawCacheData[i]);
		const value = Number(rawCacheData[i + 1]);

		if (timestamp >= lastHour) {
			hourlyTokens += value;
		}
		if (timestamp >= yesterday) {
			dailyTokens += value;
		}

		summary[timestamp] = value;
	}

	return {
		hourlyTokens,
		dailyTokens,
		summary
	};
};

const checkLimits = async (userData) => {
	const { hourlyTokens, dailyTokens } = await getTokenUsage(userData);

	const subscriberList = await sb.Cache.getByPrefix("twitch-subscriber-list-supinic");
	const isSubscribed = subscriberList.some(i => i.user_id === context.user.Twitch_ID);

	const userLimits = (isSubscribed)
		? ChatGptConfig.userTokenLimits.subscriber
		: ChatGptConfig.userTokenLimits.regular;

	if (hourlyTokens >= userLimits.hourly) {
		return {
			success: false,
			reply: `You have used up all your ChatGPT tokens for this hour! Try again later.`
		};
	}
	else if (dailyTokens >= userLimits.daily) {
		return {
			success: false,
			reply: `You have used up all tyour ChatGPT tokens for today! Try again later.`
		};
	}

	return {
		success: true
	};
};

const addUsageRecord = async (userData, value) => {
	const cacheKey = createCacheKey(userData.ID);
	return await sb.Cache.server.zadd(cacheKey, sb.Date.now(), value);
};

module.exports = {
	getTokenUsage,
	checkLimits,
	addUsageRecord
};
