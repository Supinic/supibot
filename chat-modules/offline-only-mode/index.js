module.exports = {
	Name: "offline-only-mode",
	Events: ["online", "offline"],
	Description: "Makes Supibot go into Read-only mode when the channel is online. Reverts back when the channel goes offline.",
	Code: (async function (context) {
		if (context.event === "online" && context.channel.Mode !== "Read") {
			context.channel.Mode = "Read";
		}	
		else if (context.event === "offline" && context.channel.Mode === "Read") {
			context.channel.Mode = "Write";
		}
	}),
	Author: "supinic"
};