module.exports = {
	Name: "osrs-cml-refresh",
	Expression: "0 0 2 * * *",
	Defer: (() => ({
		start: 0,
		end: 600000
	})),
	Type: "Bot",
	Code: (async function updateRunescapeMathLabs () {
		console.time("Updating OSRS CML");
		await sb.Got.instances.FakeAgent("https://www.crystalmathlabs.com/tracker/update.php?player=supinic");
		console.timeEnd("Updating OSRS CML");
	})
};