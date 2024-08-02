module.exports = {
	name: "rename",
	aliases: ["renamed"],
	description: [
		`<code>$bot rename channel:(channel)</code>`,
		`<code>$bot renamed channel:(channel)</code>`,
		"If you recently renamed your Twitch account, you can use this command to get Supibot back immediately!",
		"This also works for other channels that you are an ambassador in.",
	],
	execute: async (context, options = {}) => {
		const { channelData } = options;

		if (channelData.Platform.Name !== "twitch") {
			return {
				success: false,
				reply: `Adding me back to recently renamed channels is only available on Twitch!`
			};
		}
		else {
			return {
				reply: `
					Ideally, you should never need to do this anymore 😊
					However, if you still have issues with me not working in your chat,
				 	please let @Supinic know.			 
				 `
			};
		}
	}
};
