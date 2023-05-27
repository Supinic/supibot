const defaultFishingData = Object.freeze({
	catch: {
		luckyStreak: 0,
		dryStreak: 0,
		total: 0,
		types: {}
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
		maxFishType: null
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
		weight: 0.5
	},
	{
		name: "💀",
		sellable: true,
		size: false,
		type: "junk",
		price: 5,
		weight: 1
	},
	{
		name: "🥾",
		sellable: true,
		size: false,
		type: "junk",
		price: 20,
		weight: 0.25
	},
	{
		name: "🌿",
		sellable: true,
		size: false,
		type: "junk",
		price: 2,
		weight: 1
	},
	{
		name: "🍂",
		sellable: true,
		size: false,
		type: "junk",
		price: 1,
		weight: 1
	},
	{
		name: "🧦",
		sellable: true,
		size: false,
		type: "junk",
		price: 5,
		weight: 1
	},
	{
		name: "🌿",
		sellable: true,
		size: false,
		type: "junk",
		price: 10,
		weight: 1
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

const getEmote = async (context, type) => {
	const list = (type === "success") ? successEmotes : failureEmotes;
	const fallback = (type === "success") ? "😃" : "😔";

	return await context.getBestAvailableEmote(list, fallback, { shuffle: true });
};

const getWeightedCatch = (type) => {
	const applicableItems = itemTypes.filter(i => i.type === type);
	const totalWeight = applicableItems.reduce((acc, cur) => acc + cur.weight ?? 1, 0);

	let indexedWeight = 0;
	const roll = sb.Utils.random(1, totalWeight);
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

const COIN_EMOJI = "🪙";

module.exports = {
	COIN_EMOJI,
	baitTypes,
	itemTypeDefinitions,
	getCatchMessage,
	getEmote,
	getInitialStats,
	getWeightedCatch,
	itemTypes
};

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
 * @property {Object} catch
 * @property {number} catch.fish
 * @property {number} catch.junk
 * @property {number} catch.dryStreak
 * @property {number} catch.luckyStreak
 * @property {Record<string, number>} catch.types
 * @property {number} readyTimestamp
 * @property {number} coins
 */
