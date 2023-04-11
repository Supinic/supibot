const ChatGptConfig = require("./config.json");
const createCacheKey = (id) => `gpt-token-usage-user-${id}`;

// Cull the sorted Redis set from values that are too old to keep track of
const removeRedundantSortedListValues = async (cacheKey) => {
	const yesterday = new sb.Date().addDays(-1).valueOf();
	await sb.Cache.server.zremrangebyscore(cacheKey, 0, yesterday);
};

/**
 * @param {User} userData
 * @returns {Promise<{
 * summary: Record<string, number>,
 * dailyTokens: number,
 * hourlyTokens: number,
 * nextDailyReset: number,
 * nextHourlyReset: number
 * }>}
 */
const getTokenUsage = async (userData) => {
	const cacheKey = createCacheKey(userData.ID);
	await removeRedundantSortedListValues(cacheKey);

	const now = sb.Date.now();
	const lastHour = new sb.Date().addHours(-1).valueOf();
	const yesterday = new sb.Date().addDays(-1).valueOf();
	const rawCacheData = await sb.Cache.server.zrangebyscore(cacheKey, yesterday, now, "WITHSCORES");

	// Retrieve the cached values along with their timestamps
	let hourlyTokens = 0;
	let dailyTokens = 0;
	let nextHourlyReset = Infinity;
	let nextDailyReset = Infinity;
	const summary = {};

	for (let i = 0; i < rawCacheData.length; i += 2) {
		const value = Number(rawCacheData[i]);
		const timestamp = Number(rawCacheData[i + 1]);

		if (timestamp >= lastHour) {
			nextDailyReset = Math.min(nextDailyReset, timestamp);
			hourlyTokens += value;
		}
		if (timestamp >= yesterday) {
			nextHourlyReset = Math.min(nextHourlyReset, timestamp);
			dailyTokens += value;
		}

		summary[timestamp] = value;
	}

	return {
		hourlyTokens,
		dailyTokens,
		nextHourlyReset,
		nextDailyReset,
		summary
	};
};

/**
 * @param userData
 * @returns {Promise<{hourly: number, daily: number}>}
 */
const determineUserLimits = async (userData) => {
	const { controller } = sb.Platform.get("twitch");
	const isSubscribed = await controller.fetchUserCacheSubscription(userData, "supinic");

	return (isSubscribed)
		? ChatGptConfig.userTokenLimits.subscriber
		: ChatGptConfig.userTokenLimits.regular;
};

/**
 * @param userData
 * @returns {Promise<{success: true}|{success: false, reply: string}>}
 */
const checkLimits = async (userData) => {
	const {
		hourlyTokens,
		dailyTokens,
		nextDailyReset,
		nextHourlyReset
	} = await getTokenUsage(userData);

	const userLimits = await determineUserLimits(userData);

	if (dailyTokens >= userLimits.daily) {
		const delta = (nextDailyReset !== Infinity)
			? `${sb.Utils.timeDelta(nextDailyReset)}`
			: "later";

		return {
			success: false,
			reply: `You have used up all your ChatGPT tokens for today! Try again ${delta}.`
		};
	}
	else if (hourlyTokens >= userLimits.hourly) {
		const delta = (nextHourlyReset !== Infinity)
			? `${sb.Utils.timeDelta(nextHourlyReset)}`
			: "later";

		return {
			success: false,
			reply: `You have used up all your ChatGPT tokens for this hour! Try again ${delta}.`
		};
	}

	return {
		success: true
	};
};

const addUsageRecord = async (userData, value, modelName) => {
	const { usageDivisor } = ChatGptConfig.models[modelName];
	const cacheKey = createCacheKey(userData.ID);
	const normalizedValue = sb.Utils.round(value / usageDivisor, 2);

	return await sb.Cache.server.zadd(cacheKey, sb.Date.now(), normalizedValue);
};

module.exports = {
	getTokenUsage,
	determineUserLimits,
	checkLimits,
	addUsageRecord
};
