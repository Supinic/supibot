module.exports = {
	Name: "raid-react",
	Events: ["raid"],
	Description: "According to arguments, reacts to a Twitch channel being raided.",
	Code: (async function chatModuleRaidReact (context, definition) {
		if (context.platform.Name !== "twitch") {
			return;
		}
		else if (args.length === 0) {
			return;
		}

		const { channel, platform, user } = context;
		if (!user) {
			return;
		}
		else if (user.Name === platform.Self_Name) {
			return;
		}

		const { response, callback } = definition;
		if (typeof response === "string") {
			await channel.send(response);
		}
		else if (typeof callback === "function") {
			await callback(context, item);
		}
		else {
			console.warn("Incorrect raid chat-module response type", {
				chatModule: this.Name,
				channel: channel.ID,
				definition
			});
		}
	}),
	Author: "supinic"
};