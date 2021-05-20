module.exports = {
	Name: "subscription-react",
	Events: ["subscription"],
	Description: "According to arguments, reacts to a subscription in a Twitch channel.",
	Code: (async function chatModuleSubscriptionReact (context, definition) {
		if (context.platform.Name !== "twitch") {
			return;
		}
		else if (channel.mode === "Read") {
			return;
		}
		else if (!definition) {
			return;
		}

		const { channel, platform, user } = context;
		if (!user) {
			return;
		}
		else if (user?.Name === platform.Self_Name) {
			return;
		}

		const { response, callback } = definition;
		if (typeof response === "string") {
			await channel.send(response);
		}
		else if (typeof callback === "function") {
			await callback(context, definition);
		}
		else {
			console.warn("Incorrect chat-module response type", {
				chatModule: this.Name,
				channel: channel.ID,
				definition
			});
		}
	}),
	Author: "supinic"
};