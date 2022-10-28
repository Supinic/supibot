const eventTypeFileList = [
	"changelog",
	"channel-live",
	"ggg",
	"nodejs",
	"osrs",
	"runelite",
	"rust",
	"suggestion"
];

const subscriptionTypes = [];
for (const file of eventTypeFileList) {
	try {
		const definition = require(`./${file}.js`);
		subscriptionTypes.push(definition);
	}
	catch (e) {
		console.warn(`Could not load subscription event "${file}!`, e);
	}
}

module.exports = subscriptionTypes;
