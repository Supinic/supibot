import { SupiDate } from "supi-core";
import { randomInt } from "../../utils/command-utils.js";
import fortuneCookieData from "./fortune-cookies.json" with { type: "json" };
import type { UserDataPropertyMap } from "../../classes/custom-data-properties.js";
import type { ResultFailure } from "../../classes/command.js";

type CookieData = NonNullable<UserDataPropertyMap["cookie"]>;
type UserOptions = {
	hasDoubleCookieAccess?: boolean;
};
type CookieLogicResponse = { success: boolean; type: string; } | ResultFailure;

const basicStats = {
	lastTimestamp: {
		daily: 0,
		received: 0
	},
	today: {
		timestamp: 0,
		donated: 0,
		received: 0,
		eaten: {
			daily: 0,
			received: 0
		}
	},
	total: {
		donated: 0,
		received: 0,
		eaten: {
			daily: 0,
			received: 0
		}
	},
	legacy: {
		daily: 0,
		donated: 0,
		received: 0
	}
} satisfies CookieData;

const getInitialStats = () => structuredClone(basicStats);

/**
 * Determines if the cookie data has an outdated daily property.
 */
const hasOutdatedDailyStats = (data: CookieData): boolean => {
	const today = SupiDate.getTodayUTC();
	return (data.lastTimestamp.daily < today);
};

const resetDailyStats = (data: CookieData): void => {
	data.lastTimestamp.daily = 0;
	data.today.donated = 0;
	data.today.received = 0;
	data.today.eaten.daily = 0;
	data.today.eaten.received = 0;
};

/**
 * Determines if an extra cookie is available to be eaten today.
 */
const hasExtraCookieAvailable = (data: CookieData, options: UserOptions = {}): boolean => {
	if (options.hasDoubleCookieAccess !== true) {
		return false;
	}

	const used = data.today.eaten.daily + data.today.donated;
	return (used === 1);
};

/**
 * Determines what type of cookie is available to be eaten today.
 */
const determineAvailableDailyCookieType = (data: CookieData, options: UserOptions = {}): "daily" | "golden" | "none" => {
	const today = SupiDate.getTodayUTC();
	if (options.hasDoubleCookieAccess === true) {
		const used = data.today.eaten.daily + data.today.donated;
		if (used === 0) {
			return "daily";
		}
		else if (used === 1) {
			return "golden";
		}
		else {
			return "none";
		}
	}

	if (data.lastTimestamp.daily !== today) {
		return "daily";
	}
	else {
		return "none";
	}
};

/**
 * Determines if a cookie is available to be eaten today.
 */
const canEatDailyCookie = (data: CookieData, options: UserOptions = {}): boolean => {
	const today = SupiDate.getTodayUTC();
	if (options.hasDoubleCookieAccess === true) {
		const used = data.today.eaten.daily + data.today.donated;
		return (used < 2);
	}

	return (data.lastTimestamp.daily !== today);
};

/**
 * Determines if a cookie (whether received from someone else as a gift) is available to be eaten.
 */
const canEatReceivedCookie = (data: CookieData): boolean => {
	const today = SupiDate.getTodayUTC();
	return (data.lastTimestamp.received === today);
};

/**
 * Determines if the user has donated their cookie(s) today.
 */
const hasDonatedDailyCookie = (data: CookieData): boolean => {
	const today = SupiDate.getTodayUTC();
	return (data.lastTimestamp.daily === today && data.today.donated !== 0);
};

/**
 * @param {CookieData} data
 * @param {ExtraUserOptions} [options]
 * @returns {boolean} `false` if unable to eat, `true` if the process succeeded.
 */
const eatDailyCookie = (data: CookieData, options: UserOptions = {}) => {
	const today = SupiDate.getTodayUTC();
	if (!canEatDailyCookie(data, options)) {
		return false;
	}

	data.lastTimestamp.daily = today;

	// Only increment the total count if the user is eating their first cookie daily.
	// This is to prevent the "additional privileged" cookies counting for statistics.
	if (data.today.eaten.daily === 0 && data.today.donated === 0) {
		data.total.eaten.daily++;
	}

	data.today.eaten.daily++;

	return true;
};

/**
 * @returns `false` if unable to eat, `true` if the process succeeded.
 */
const eatReceivedCookie = (data: CookieData): boolean => {
	if (!canEatReceivedCookie(data)) {
		return false;
	}

	data.lastTimestamp.received = 0;
	data.today.eaten.received++;
	data.total.eaten.received++;

	return true;
};

const eatCookie = (data: CookieData, options: UserOptions = {}): CookieLogicResponse => {
	if (canEatDailyCookie(data, options)) {
		eatDailyCookie(data, options);

		const used = data.today.eaten.daily + data.today.donated;
		const isExtra = (used >= 2);
		return {
			type: (isExtra) ? "golden" : "daily",
			success: true
		};
	}
	else if (canEatReceivedCookie(data)) {
		eatReceivedCookie(data);

		return {
			type: "received",
			success: true
		};
	}
	else {
		const nextUTCMidnight = new SupiDate(SupiDate.getTodayUTC()).addHours(24);
		const delta = core.Utils.timeDelta(nextUTCMidnight);
		const rudeRoll = randomInt(1, 100);

		return {
			success: false,
			reply: (rudeRoll === 99)
				? `Stop stuffing your face so often! What are you doing, do you want to get fat? Get another cookie ${delta}.`
				: `You already opened or gifted a fortune cookie today. You can get another one at midnight UTC, which is ${delta}.`
		};
	}
};

/**
 * Attempts to donate a cookie to another user.
 * @returns {CookieLogicResponse}
 */
const donateCookie = (donator: CookieData, receiver: CookieData, donatorOptions: UserOptions = {}, receiverOptions: UserOptions = {}): CookieLogicResponse => {
	if (canEatReceivedCookie(donator)) { // Got donated cookie, can't donate those
		return {
			success: false,
			reply: "That cookie was donated to you! Eat it, don't give it away!"
		};
	}
	else if (canEatDailyCookie(donator, donatorOptions) && hasExtraCookieAvailable(donator, donatorOptions)) { // Regular cookie eaten/donated, golden available
		return {
			success: false,
			reply: `You have a golden cookie available to you, but you can't gift those away!`
		};
	}
	else if (!canEatDailyCookie(donator, donatorOptions)) { // No daily cookie left to donate to others
		return {
			success: false,
			reply: "You already ate or donated your cookie today, so you can't gift it to someone else!"
		};
	}
	else if (canEatDailyCookie(receiver, receiverOptions)) { // Receiver hasn't eaten their daily cookie yet
		if (hasExtraCookieAvailable(receiver, receiverOptions)) {
			return {
				success: false,
				reply: `That user hasn't eaten their golden cookie today, so you would be wasting your donation even more than usual! Get them to eat it!`
			};
		}
		else {
			return {
				success: false,
				reply: "That user hasn't eaten their daily cookie today, so you would be wasting your donation! Get them to eat it!"
			};
		}
	}
	else if (canEatReceivedCookie(receiver)) { // Receiver already has a donation pending
		return {
			success: false,
			reply: "That user hasn't eaten their donated cookie, so you would be wasting your donation! Get them to eat it!"
		};
	}

	const today = SupiDate.getTodayUTC();
	donator.lastTimestamp.daily = today;
	donator.today.donated++;
	donator.total.donated++;

	receiver.lastTimestamp.received = today;
	receiver.today.received++;
	receiver.total.received++;

	return {
		type: "passed",
		success: true
	};
};

/* istanbul ignore next */
const fetchRandomCookieText = (): string => {
	const cookie = core.Utils.randArray(fortuneCookieData);
	return cookie.text;
};

export default {
	determineAvailableDailyCookieType,
	canEatDailyCookie,
	canEatReceivedCookie,
	donateCookie,
	eatCookie,
	eatDailyCookie,
	eatReceivedCookie,
	fetchRandomCookieText,
	getInitialStats,
	hasDonatedDailyCookie,
	hasOutdatedDailyStats,
	resetDailyStats
};
