const eventTypeFileList = [
	"brighter-shores",
	"bun",
	"changelog",
	"channel-live",
	"deno",
	"dotnet",
	"factorio",
	"ggg",
	"msvcpp",
	"nodejs",
	"osrs",
	"python",
	"runelite",
	"rust",
	"suggestion",
	"typescript",
	"v8"
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
