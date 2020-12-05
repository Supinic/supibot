module.exports = {
	Name: "nice",
	Events: ["message"],
	Description: "Nice",
	Code: (async function (context) {
		if (!context.user) {
			return;
		}
		if (context.user.ID !== 1127 && context.message.toLowerCase() === "nice") {
			await context.channel.send("nice");
		}
	}),
	Author: "supinic"
};