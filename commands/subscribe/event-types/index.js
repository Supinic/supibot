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
		import definition from `./${file}.js`;
		subscriptionTypes.push(definition);
	}
	catch (e) {
		console.warn(`Could not load subscription event "${file}!`, e);
	}
}

export default subscriptionTypes;
