module.exports = {
	Name: "same",
	Events: ["message"],
	Description: "Same",
	Code: (async function (context) {
		if (context.user.ID !== 1127 && context.message.toLowerCase() === "same") {
			await context.channel.send("same");
		}
	}),
	Author: "supinic"
};