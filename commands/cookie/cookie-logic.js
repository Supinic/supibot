/** @type {CookieData} */
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
};

/**
 * @returns {CookieData}
 */
const getInitialStats = () => structuredClone(basicStats);

const subcommands = [
	{
		name: "donate",
		aliases: ["gift", "give"],
		default: false,
		hidden: false
	},
	{
		name: "stats",
		aliases: ["statistics"],
		default: false,
		hidden: true
	},
	{
		name: "eat",
		aliases: [],
		default: true,
		hidden: false
	}
];

/**
 * @param {string} [type]
 * @returns {string|null}
 */
const parseSubcommand = (type) => {
	let subcommand;
	const defaultSubcommand = subcommands.find(i => i.default);

	if (!type) {
		return defaultSubcommand.name;
	}
	else {
		type = type.toLowerCase();
		subcommand = subcommands.find(i => i.name === type || i.aliases.includes(type));

		return (subcommand) ? subcommand.name : null;
	}
};

/**
 * @returns {string}
 */
const getValidTypeNames = () => subcommands.filter(i => !i.hidden).map(i => i.name).join(", ");

/**
 * Determines if the cookie data has an outdated daily property.
 * @param {CookieData} data
 * @returns {boolean}
 */
const hasOutdatedDailyStats = (data) => {
	const today = sb.Date.getTodayUTC();
	return (data.lastTimestamp.daily < today);
};

/**
 * Resets the daily cookie stats.
 * @param {CookieData} data
 */
const resetDailyStats = (data) => {
	data.lastTimestamp.daily = 0;
	data.today.donated = 0;
	data.today.eaten.daily = 0;
	data.today.eaten.received = 0;
};

/**
 * Determines if an extra cookie is available to be eaten today.
 * @param data {CookieData}
 * @param [options] {ExtraUserOptions}
 * @returns {boolean}
 */
const hasExtraCookieAvailable = (data, options) => {
	if (options?.hasDoubleCookieAccess !== true) {
		return false;
	}

	const used = data.today.eaten.daily + data.today.donated;
	return (used === 1);
};

/**
 * Determines if a cookie is available to be eaten today.
 * @param data {CookieData}
 * @param [options] {ExtraUserOptions}
 * @returns {boolean}
 */
const canEatDailyCookie = (data, options) => {
	const today = sb.Date.getTodayUTC();
	if (options?.hasDoubleCookieAccess === true) {
		const used = data.today.eaten.daily + data.today.donated;
		return (used < 2);
	}

	return (data.lastTimestamp.daily !== today);
};

/**
 * Determines if a cookie, received from someone else as a gift, is available to be eaten.
 * @param {CookieData} data
 * @returns {boolean}
 */
const canEatReceivedCookie = (data) => {
	const today = sb.Date.getTodayUTC();
	return (data.lastTimestamp.received === today);
};

/**
 * Determines if the user has donated their cookie(s) today.
 * @param {CookieData} data
 * @returns {boolean}
 */
const hasDonatedDailyCookie = (data) => {
	const today = sb.Date.getTodayUTC();
	return (data.lastTimestamp.daily === today && data.today.donated !== 0);
};

/**
 * @param {CookieData} data
 * @param {ExtraUserOptions} [options]
 * @returns {boolean} `false` if unable to eat, `true` if the process succeeded.
 */
const eatDailyCookie = (data, options) => {
	const today = sb.Date.getTodayUTC();
	if (!canEatDailyCookie(data, options)) {
		return false;
	}

	data.lastTimestamp.daily = today;

	// Only increment the total count if the user is eating their first cookie daily.
	// This is to prevent the "additional privileged" cookies counting for statistics.
	if (data.today.eaten.daily === 0) {
		data.total.eaten.daily++;
	}

	data.today.eaten.daily++;

	return true;
};

/**
 * @param {CookieData} data
 * @returns {boolean} `false` if unable to eat, `true` if the process succeeded.
 */
const eatReceivedCookie = (data) => {
	if (!canEatReceivedCookie(data)) {
		return false;
	}

	data.lastTimestamp.received = 0;
	data.today.eaten.received++;
	data.total.eaten.received++;

	return true;
};

/**
 * @param {CookieData} data
 * @param {ExtraUserOptions} [options]
 * @returns {CookieLogicResponse}
 */
const eatCookie = (data, options = {}) => {
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
		const nextUTCMidnight = new sb.Date(sb.Date.getTodayUTC()).addHours(24);
		const delta = sb.Utils.timeDelta(nextUTCMidnight);
		const rudeRoll = sb.Utils.random(1, 100);

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
 * @param {CookieData} donator
 * @param {CookieData} receiver
 * @param {ExtraUserOptions} [donatorOptions]
 * @param {ExtraUserOptions} [receiverOptions]
 * @returns {CookieLogicResponse}
 */
const donateCookie = (donator, receiver, donatorOptions = {}, receiverOptions = {}) => {
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

	const today = sb.Date.getTodayUTC();
	donator.lastTimestamp.daily = today;
	donator.today.donated++;
	donator.total.donated++;

	receiver.lastTimestamp.received = today;
	receiver.today.received++;
	receiver.total.received++;

	return {
		success: true
	};
};

/* istanbul ignore next */
const fetchRandomCookieText = async () => (
	await sb.Query.getRecordset(rs => rs
		.select("Text")
		.from("data", "Fortune_Cookie")
		.orderBy("RAND()")
		.limit(1)
		.single()
		.flat("Text")
	)
);

module.exports = {
	subcommands,
	canEatDailyCookie,
	canEatReceivedCookie,
	donateCookie,
	eatCookie,
	eatDailyCookie,
	eatReceivedCookie,
	fetchRandomCookieText,
	getInitialStats,
	getValidTypeNames,
	hasDonatedDailyCookie,
	hasOutdatedDailyStats,
	parseSubcommand,
	resetDailyStats
};

/**
 * @typedef {Object} CookieLogicResponse
 * @property {boolean} success
 * @property {string} type
 * @property {string} type
 */

/**
 * @typedef {Object} CookieData
 * @property {Object} lastTimestamp
 * @property {number} lastTimestamp.daily
 * @property {number} lastTimestamp.received
 * @property {Object} today
 * @property {number} today.timestamp
 * @property {number} today.donated
 * @property {number} today.received
 * @property {Object} today.eaten
 * @property {number} today.eaten.daily
 * @property {number} today.eaten.received
 * @property {Object} total
 * @property {number} total.donated
 * @property {number} total.received
 * @property {Object} total.eaten
 * @property {number} total.eaten.daily
 * @property {number} total.eaten.received
 * @property {Object} legacy
 * @property {number} legacy.daily
 * @property {number} legacy.donated
 * @property {number} legacy.received
 */

/**
 * @typedef {Object} ExtraUserOptions
 * @property {boolean} hasDoubleCookieAccess
 */
