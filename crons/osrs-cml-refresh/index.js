module.exports = {
	Name: "osrs-cml-refresh",
	Expression: "0 0 2 * * *",
	Defer: "{\r\n\t\"start\": 0,\r\n\t\"end\": 600000\r\n}",
	Type: "Bot",
	Code: (async function updateRunescapeMathLabs () {
		console.time("Updating OSRS CML");
		await sb.Got.instances.FakeAgent("https://www.crystalmathlabs.com/tracker/update.php?player=supinic");
		console.timeEnd("Updating OSRS CML");
	})
};