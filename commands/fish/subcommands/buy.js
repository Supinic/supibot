const { baitTypes } = require("./fishing-utils.js");
const priceList = baitTypes.map((i, index) => 2 + (3 * index));

const baitInfo = [];
for (let i = 0; i < baitTypes.length; i++) {
	baitInfo.push(`${baitTypes[i]} costs ${priceList[i]}🪙`);
}

const baitInfoString = baitInfo.join("; ");
module.exports = {
	name: "buy",
	aliases: [],
	description: [],
	execute: async () => ({
		reply: sb.Utils.tag.trim `
			Bait slightly improves your catch chance.
			Use it like this: "$fish 🦗" to buy, and use immediately.
			Not reusable.
			Available types: ${baitInfoString}
		`
	})
};
