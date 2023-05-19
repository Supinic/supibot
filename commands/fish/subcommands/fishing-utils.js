const defaultFishingData = Object.freeze({
	catch: {
		total: 0,
		types: {}
	},
	readyTimestamp: 0,
	coins: 0,
	lifetime: {
		fish: 0,
		coins: 0,
		attempts: 0
	}
});

const baitTypes = ["🪱", "🪰", "🦗"];
const fishTypes = ["🧦", "💀", "🦂", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐸", "🐢", "🐍", "🐙", "🐚"];

const getInitialStats = () => structuredClone(defaultFishingData);

module.exports = {
	baitTypes,
	getInitialStats,
	fishTypes
};
