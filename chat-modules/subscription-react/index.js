module.exports = {
	Name: "subscription-react",
	Events: ["subscription"],
	Description: "According to arguments, reacts to a subscription in a Twitch channel.",
	Code: (async function chatModuleNice (context, definition) {
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

		const { message, listener } = definition;
		if (typeof listener === "function") {
			await listener(context, definition);
		}
		else if (typeof message === "string") {
			await channel.send(message);
		}
		else {
			console.warn("Incorrect chat-module params definition", {
				chatModule: this.Name,
				channel: channel.ID,
				definition
			});
		}
	}),
	Author: "supinic"
};