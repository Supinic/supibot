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

const baitTypes = ["🪱", "🪰", "🦗"];
const fishTypes = [
	{
		name: "🧦",
		sellable: false,
		size: false
	},
	{
		name: "🦂",
		sellable: true,
		size: true
	},
	{
		name: "🦑",
		sellable: true,
		size: true
	},
	{
		name: "🦐",
		sellable: true,
		size: true
	},
	{
		name: "🦞",
		sellable: true,
		size: true
	},
	{
		name: "🦀",
		sellable: true,
		size: true
	},
	{
		name: "🐡",
		sellable: true,
		size: true
	},
	{
		name: "🐠",
		sellable: true,
		size: true
	},
	{
		name: "🐟",
		sellable: true,
		size: true
	},
	{
		name: "🐬",
		sellable: true,
		size: true
	},
	{
		name: "🐳",
		sellable: true,
		size: true
	},
	{
		name: "🐋",
		sellable: true,
		size: true
	},
	{
		name: "🦈",
		sellable: true,
		size: true
	},
	{
		name: "🐊",
		sellable: true,
		size: true
	},
	{
		name: "🐸",
		sellable: true,
		size: true
	},
	{
		name: "🐢",
		sellable: true,
		size: true
	},
	{
		name: "🐙",
		sellable: true,
		size: true
	},
	{
		name: "🐚",
		sellable: true,
		size: false
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

module.exports = {
	baitTypes,
	getEmote,
	getInitialStats,
	fishTypes
};

/**
 * @typedef {Object} UserFishData
 * @property {Object} lifetime
 * @property {number} lifetime.fish
 * @property {number} lifetime.coins
 * @property {number} lifetime.sold
 * @property {number} lifetime.baitUsed
 * @property {number} lifetime.attempts
 * @property {number} lifetime.maxFishSize
 * @property {string|null} lifetime.maxFishType
 * @property {number} lifetime.dryStreak
 * @property {number} lifetime.luckyStreak
 * @property {Object} catch
 * @property {number} catch.total
 * @property {number} catch.dryStreak
 * @property {number} catch.luckyStreak
 * @property {Record<string, number>} catch.types
 * @property {number} readyTimestamp
 * @property {number} coins
 */
