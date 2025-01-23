import ChatGptConfig from "./config.json";
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
 * dailyReset: number,
 * hourlyReset: number,
 * userLimits: {
 *  daily: number,
 *  hourly: number
 * }
 * }>}
 */
export const getTokenUsage = async (userData) => {
	const cacheKey = createCacheKey(userData.ID);
	await removeRedundantSortedListValues(cacheKey);

	const now = sb.Date.now();
	const lastHour = new sb.Date().addHours(-1).valueOf();
	const yesterday = new sb.Date().addDays(-1).valueOf();
	const rawCacheData = await sb.Cache.server.zrangebyscore(cacheKey, yesterday, now, "WITHSCORES");

	const cacheData = [];
	for (let i = 0; i < rawCacheData.length; i += 2) {
		cacheData.push({
			value: Number(rawCacheData[i]),
			timestamp: Number(rawCacheData[i + 1])
		});
	}

	// Retrieve the cached values along with their timestamps
	let hourlyTokens = 0;
	let dailyTokens = 0;
	let firstHourlyUsage = Infinity;
	let firstDailyUsage = Infinity;
	const summary = {};

	for (const { value, timestamp } of cacheData) {
		if (timestamp >= lastHour) {
			firstHourlyUsage = Math.min(firstHourlyUsage, timestamp);
			hourlyTokens += value;
		}
		if (timestamp >= yesterday) {
			firstDailyUsage = Math.min(firstDailyUsage, timestamp);
			dailyTokens += value;
		}

		summary[timestamp] = value;
	}

	let hourlyReset = null;
	let dailyReset = null;
	let hourlyCounter = hourlyTokens;
	let dailyCounter = dailyTokens;
	const userLimits = await determineUserLimits(userData);

	for (const { value, timestamp } of cacheData) {
		if (!hourlyReset && timestamp >= lastHour) {
			hourlyCounter -= value;
			if (hourlyCounter < userLimits.hourly) {
				hourlyReset = timestamp;
			}
		}
		if (!dailyReset && timestamp >= yesterday) {
			dailyCounter -= value;
			if (dailyCounter < userLimits.daily) {
				dailyReset = timestamp;
			}
		}
	}

	if (cacheData.length > 0) {
		hourlyReset ??= cacheData.at(-1).timestamp;
		dailyReset ??= cacheData.at(-1).timestamp;
	}

	return {
		hourlyTokens,
		dailyTokens,
		hourlyReset,
		dailyReset,
		summary,
		userLimits
	};
};

/**
 * @param userData
 * @returns {Promise<{hourly: number, daily: number}>}
 */
export const determineUserLimits = async (userData) => {
	const platform = sb.Platform.get("twitch");
	const isSubscribed = await platform.fetchUserAdminSubscription(userData);

	return (isSubscribed)
		? ChatGptConfig.userTokenLimits.subscriber
		: ChatGptConfig.userTokenLimits.regular;
};

/**
 * @param userData
 * @returns {Promise<{success: true}|{success: false, reply: string}>}
 */
export const checkLimits = async (userData) => {
	const {
		hourlyTokens,
		dailyTokens,
		hourlyReset,
		dailyReset,
		userLimits
	} = await getTokenUsage(userData);

	if (dailyTokens >= userLimits.daily) {
		const nextDailyReset = new sb.Date(dailyReset).addDays(1);
		const delta = (nextDailyReset !== Infinity)
			? `${sb.Utils.timeDelta(nextDailyReset)}`
			: "later";

		return {
			success: false,
			reply: `You have used up all your ChatGPT tokens for today! Try again ${delta}.`
		};
	}
	else if (hourlyTokens >= userLimits.hourly) {
		const nextHourlyReset = new sb.Date(hourlyReset).addHours(1);
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

export const addUsageRecord = async (userData, value, modelName) => {
	const { pricePerMtoken } = ChatGptConfig.models[modelName];
	const cacheKey = createCacheKey(userData.ID);
	const normalizedValue = sb.Utils.round(value * pricePerMtoken, 2);

	return await sb.Cache.server.zadd(cacheKey, sb.Date.now(), normalizedValue);
};

export default {
	getTokenUsage,
	determineUserLimits,
	checkLimits,
	addUsageRecord
};
