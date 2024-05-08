const { randomInt } = require("../../../utils/command-utils.js");

const defaultFishingData = Object.freeze({
	catch: {
		luckyStreak: 0,
		dryStreak: 0,
		fish: 0,
		types: {}
	},
	trap: {
		active: false,
		start: 0,
		end: 0,
		duration: 0
	},
	readyTimestamp: 0,
	coins: 0,
	lifetime: {
		fish: 0,
		coins: 0,
		sold: 0,
		baitUsed: 0,
		attempts: 0,
		dryStreak: 0,
		luckyStreak: 0,
		maxFishSize: 0,
		maxFishType: null,
		trap: {
			times: 0,
			timeSpent: 0,
			bestFishCatch: 0,
			cancelled: 0
		}
	}
});

const baitTypes = [
	{
		emoji: "🪱",
		name: "worm",
		price: 2,
		roll: 16
	},
	{
		emoji: "🪰",
		name: "fly",
		price: 5,
		roll: 14
	},
	{
		emoji: "🦗",
		name: "cricket",
		price: 8,
		roll: 12
	}
];

const itemTypes = [
	{
		name: "🥫",
		sellable: true,
		size: false,
		type: "junk",
		price: 8,
		weight: 25
	},
	{
		name: "💀",
		sellable: true,
		size: false,
		type: "junk",
		price: 5,
		weight: 10
	},
	{
		name: "🥾",
		sellable: true,
		size: false,
		type: "junk",
		price: 20,
		weight: 5
	},
	{
		name: "🌿",
		sellable: true,
		size: false,
		type: "junk",
		price: 2,
		weight: 200
	},
	{
		name: "🍂",
		sellable: true,
		size: false,
		type: "junk",
		price: 1,
		weight: 100
	},
	{
		name: "🧦",
		sellable: true,
		size: false,
		type: "junk",
		price: 5,
		weight: 50
	},
	{
		name: "🦂",
		sellable: true,
		size: true,
		type: "fish",
		price: 50,
		weight: 1
	},
	{
		name: "🦑",
		sellable: true,
		size: true,
		type: "fish",
		price: 50,
		weight: 1
	},
	{
		name: "🦐",
		sellable: true,
		size: true,
		type: "fish",
		price: 50,
		weight: 1
	},
	{
		name: "🦞",
		sellable: true,
		size: true,
		type: "fish",
		price: 50,
		weight: 1
	},
	{
		name: "🦀",
		sellable: true,
		size: true,
		type: "fish",
		price: 50,
		weight: 1
	},
	{
		name: "🐡",
		sellable: true,
		size: true,
		type: "fish",
		price: 50,
		weight: 1
	},
	{
		name: "🐠",
		sellable: true,
		size: true,
		type: "fish",
		price: 50,
		weight: 1
	},
	{
		name: "🐟",
		sellable: true,
		size: true,
		type: "fish",
		price: 50,
		weight: 1
	},
	{
		name: "🐬",
		sellable: true,
		size: true,
		type: "fish",
		price: 50,
		weight: 1
	},
	{
		name: "🐳",
		sellable: true,
		size: true,
		type: "fish",
		price: 50,
		weight: 1
	},
	{
		name: "🐋",
		sellable: true,
		size: true,
		type: "fish",
		price: 50,
		weight: 1
	},
	{
		name: "🦈",
		sellable: true,
		size: true,
		type: "fish",
		price: 50,
		weight: 1
	},
	{
		name: "🐊",
		sellable: true,
		size: true,
		type: "fish",
		price: 50,
		weight: 1
	},
	{
		name: "🐸",
		sellable: true,
		size: true,
		type: "fish",
		price: 50,
		weight: 1
	},
	{
		name: "🐢",
		sellable: true,
		size: true,
		type: "fish",
		price: 50,
		weight: 1
	},
	{
		name: "🐙",
		sellable: true,
		size: true,
		type: "fish",
		price: 50,
		weight: 1
	},
	{
		name: "🐚",
		sellable: true,
		size: false,
		type: "fish",
		price: 50,
		weight: 1
	}
];

const itemTypeDefinitions = [
	{
		name: "fish",
		description: "fish"
	},
	{
		name: "junk",
		description: "pieces of junk"
	}
];

/**
 * @return {UserFishData}
 */
const getInitialStats = () => structuredClone(defaultFishingData);

const failureEmotes = [
	`PoroSad`,
	`peepoSad`,
	`SadLain`,
	`Sadeg`,
	`Sadge`,
	`SadgeCry`,
	`SadCat`,
	`FeelsBadMan`,
	`RAGEY`,
	`docnotL`,
	`ReallyMad`,
	`PunOko`,
	`SirMad`,
	`SirSad`,
	`KannaCry`,
	`RemCry`,
	`catCry`,
	`PepeHands`,
	`Madge`,
	`reeferSad`,
	`sadE`,
	`NotLikeThis`,
	`NLT`,
	`FailFish`,
	`SAJ`,
	`SAJI`
];
const successEmotes = [
	`SUGOI`,
	`LETSGO`,
	`PagMan`,
	`PAGLADA`,
	`PAGGING`,
	`PagBounce`,
	`PagChomp`,
	`PogU`,
	`Pog`,
	`PogChamp`,
	`WakuWaku`,
	`sheCrazy`,
	`heCrazy`,
	`WICKED`,
	`FeelsStrongMan`,
	`MUGA`,
	`Wowee`,
	`PogBones`,
	`peepoPog`,
	`peepoPag`,
	`Shockisu`
];

/**
 * @param context
 * @param {"success"|"failure"} type
 * @return {Promise<string>}
 */
const getEmote = async (context, type) => {
	const list = (type === "success") ? successEmotes : failureEmotes;
	const fallback = (type === "success") ? "😃" : "😔";

	return await context.getBestAvailableEmote(list, fallback, { shuffle: true });
};

/**
 * Returns a randomly weighted catch item.
 * @param {CatchType} type
 * @return {CatchItem}
 */
const getWeightedCatch = (type) => {
	const applicableItems = itemTypes.filter(i => i.type === type);
	const totalWeight = applicableItems.reduce((acc, cur) => acc + cur.weight ?? 1, 0);

	let indexedWeight = 0;
	const roll = randomInt(1, totalWeight);
	for (const item of applicableItems) {
		indexedWeight += item.weight;

		if (roll <= indexedWeight) {
			return item;
		}
	}

	throw new Error("Invalid weighted roll result");
};

const catchMessages = {
	fish: [],
	junk: [
		"Oops! You snagged something that's better off in the garbage.",
		"Oh dear, it looks like you've reeled in some unwanted clutter.",
		"It seems luck wasn't on your side this time. You caught a piece of junk.",
		"You've landed a piece of useless debris.",
		"You pull up something disappointing.",
		"Ah... just another item for the scrap heap.",
		"Wow! Would you look at that! ...nevermind, it's just junk.",
		"Your line gets tangled up in some junk."
	]
};

const getCatchMessage = (type) => sb.Utils.randArray(catchMessages[type]);

/**
 * @param {string|null} [bait]
 * @return {{catch: null, type: string}|{catch: CatchItem, type: string}}
 */
const rollCatch = (bait = null) => {
	let odds = 20;
	if (bait) {
		const baitData = baitTypes.find(i => i.emoji === bait || i.name === bait);
		if (!baitData) {
			throw new sb.Error({
				message: "Invalid bait type provided",
				args: { bait }
			});
		}

		odds = baitData.roll;
	}

	const roll = randomInt(1, odds);
	if (roll === 1) {
		return {
			catch: getWeightedCatch("fish"),
			type: "fish"
		};
	}
	else {
		const roll = randomInt(1, 4);
		if (roll === 1) {
			return {
				catch: getWeightedCatch("junk"),
				type: "junk"
			};
		}
		else {
			return {
				catch: null,
				type: "nothing"
			};
		}
	}
};

const addFish = (fishData, emoji) => {
	fishData.catch.fish = (fishData.catch.fish ?? 0) + 1;
	fishData.lifetime.fish = (fishData.lifetime.fish ?? 0) + 1;

	fishData.catch.types ??= {};
	fishData.catch.types[emoji] = (fishData.catch.types[emoji] ?? 0) + 1;
};

const addJunk = (fishData, emoji) => {
	fishData.catch.junk = (fishData.catch.junk ?? 0) + 1;
	fishData.lifetime.junk = (fishData.lifetime.junk ?? 0) + 1;

	fishData.catch.types ??= {};
	fishData.catch.types[emoji] = (fishData.catch.types[emoji] ?? 0) + 1;
};

const saveData = async (context, data) => {
	await context.user.setDataProperty("fishData", data);
};

const hasFishedBefore = (fishData) => {
	if (!fishData) {
		return false;
	}

	const fishAttempts = fishData.lifetime.attempts;
	const trapAttempts = fishData.lifetime.trap?.times ?? 0;
	return (fishAttempts > 0 || trapAttempts > 0);
};

const COIN_EMOJI = "🪙";

module.exports = {
	COIN_EMOJI,
	baitTypes,
	itemTypeDefinitions,
	addFish,
	addJunk,
	getCatchMessage,
	getEmote,
	getInitialStats,
	getWeightedCatch,
	hasFishedBefore,
	rollCatch,
	saveData,
	itemTypes
};

/**
 * @typedef {"fish"|"junk"} CatchType
 */

/**
 * @typedef {Object} CatchItem
 * @property {string} name
 * @property {boolean} sellable
 * @property {CatchType} type
 * @property {number} price
 * @property {number} weight RNG weighting (not size weighting)
 */

/**
 * @typedef {Object} UserFishData
 * @property {Object} lifetime
 * @property {number} lifetime.fish
 * @property {number} lifetime.junk
 * @property {number} lifetime.coins
 * @property {number} lifetime.sold
 * @property {number} lifetime.scrapped
 * @property {number} lifetime.baitUsed
 * @property {number} lifetime.attempts
 * @property {number} lifetime.maxFishSize
 * @property {string|null} lifetime.maxFishType
 * @property {number} lifetime.dryStreak
 * @property {number} lifetime.luckyStreak
 * @property {Object} lifetime.trap
 * @property {number} lifetime.trap.times
 * @property {number} lifetime.trap.timeSpent (minutes)
 * @property {number} lifetime.trap.bestFishCatch
 * @property {number} lifetime.trap.cancelled
 *
 * @property {Object} catch
 * @property {number} catch.fish
 * @property {number} catch.junk
 * @property {number} catch.dryStreak
 * @property {number} catch.luckyStreak
 * @property {Record<string, number|undefined>} catch.types
 *
 * @property {Object} trap
 * @property {boolean} trap.active
 * @property {number} trap.start
 * @property {number} trap.end
 * @property {number} trap.duration
 *
 * @property {number} readyTimestamp
 * @property {number} coins
 *
 * @property {boolean} [removedFromLeaderboards]
 */
