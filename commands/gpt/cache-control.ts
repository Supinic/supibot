import { SupiDate, SupiError } from "supi-core";
import ChatGptConfig from "./config.json" with { type: "json" };
import type { User } from "../../classes/user.js";
import type { Platform } from "../../platforms/template.js";
import type { TwitchPlatform } from "../../platforms/twitch.js";
import type { ModelData } from "./config-schema.js";

const createCacheKey = (id: number) => `gpt-token-usage-user-${id}`;
const isTwitchPlatform = (input: Platform | null): input is TwitchPlatform => {
	if (input === null) {
		return false;
	}

	return (input.name === "twitch");
};

// Cull the sorted Redis set from values that are too old to keep track of
const removeRedundantSortedListValues = async (cacheKey: string) => {
	const yesterday = new SupiDate().addDays(-1).valueOf();
	await core.Cache.server.zremrangebyscore(cacheKey, 0, yesterday);
};

export const determineUserLimits = async (userData: User) => {
	const platform = sb.Platform.get("twitch");
	if (!isTwitchPlatform(platform)) {
		throw new SupiError({
			message: "Assert error: Platform is not TwitchPlatform"
		});
	}

	const isSubscribed = await platform.fetchUserAdminSubscription(userData);
	return (isSubscribed)
		? ChatGptConfig.userTokenLimits.subscriber
		: ChatGptConfig.userTokenLimits.regular;
};

type TokenUsage = {
	summary: Record<string, number>;
	dailyTokens: number;
	hourlyTokens: number;
	dailyReset: number | null;
	hourlyReset: number | null;
	userLimits: {
		daily: number;
		hourly: number;
	};
};
export const getTokenUsage = async (userData: User): Promise<TokenUsage> => {
	const cacheKey = createCacheKey(userData.ID);
	await removeRedundantSortedListValues(cacheKey);

	const now = SupiDate.now();
	const lastHour = new SupiDate().addHours(-1).valueOf();
	const yesterday = new SupiDate().addDays(-1).valueOf();
	const rawCacheData = await core.Cache.server.zrangebyscore(cacheKey, yesterday, now, "WITHSCORES");

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
	// let firstHourlyUsage = Infinity;
	// let firstDailyUsage = Infinity;

	const summary: Record<string, number> = {};
	for (const { value, timestamp } of cacheData) {
		if (timestamp >= lastHour) {
			// firstHourlyUsage = Math.min(firstHourlyUsage, timestamp);
			hourlyTokens += value;
		}
		if (timestamp >= yesterday) {
			// firstDailyUsage = Math.min(firstDailyUsage, timestamp);
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

	const finalCache = cacheData.at(-1);
	if (finalCache) {
		hourlyReset ??= finalCache.timestamp;
		dailyReset ??= finalCache.timestamp;
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

export const checkLimits = async (userData: User) => {
	const {
		hourlyTokens,
		dailyTokens,
		hourlyReset,
		dailyReset,
		userLimits
	} = await getTokenUsage(userData);

	if (dailyTokens >= userLimits.daily) {
		if (dailyReset === null) {
			throw new SupiError({
				message: "Assert error: Daily reset is null while token usage exists",
				args: { dailyReset, dailyTokens }
			});
		}

		const nextDailyReset = new SupiDate(dailyReset).addDays(1);
		const delta = core.Utils.timeDelta(nextDailyReset);
		return {
			success: false,
			reply: `You have used up all your ChatGPT tokens for today! Try again ${delta}.`
		};
	}
	else if (hourlyTokens >= userLimits.hourly) {
		if (hourlyReset === null) {
			throw new SupiError({
				message: "Assert error: Hourly reset is null while token usage exists",
				args: { hourlyReset, hourlyTokens }
			});
		}

		const nextHourlyReset = new SupiDate(hourlyReset).addHours(1);
		const delta = core.Utils.timeDelta(nextHourlyReset);
		return {
			success: false,
			reply: `You have used up all your ChatGPT tokens for this hour! Try again ${delta}.`
		};
	}

	return {
		success: true
	};
};

export const addUsageRecord = async (userData: User, value: number, modelData: ModelData) => {
	const { pricePerMtoken, flatCost = 0 } = modelData;
	const cacheKey = createCacheKey(userData.ID);
	const normalizedValue = core.Utils.round(value * pricePerMtoken, 2) + flatCost;

	await core.Cache.server.zadd(cacheKey, SupiDate.now(), normalizedValue);
};

export default {
	getTokenUsage,
	determineUserLimits,
	checkLimits,
	addUsageRecord
};
