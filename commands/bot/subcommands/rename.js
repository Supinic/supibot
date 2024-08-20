module.exports = {
	name: "rename",
	aliases: ["renamed"],
	description: [
		`<code>$bot rename channel:(channel)</code>`,
		`<code>$bot renamed channel:(channel)</code>`,
		"If you recently renamed your Twitch account, you can use this command to get Supibot back immediately!",
		"This also works for other channels that you are an ambassador in."
	],
	execute: async (context, options = {}) => {
		const { channelData } = options;
		if (channelData.Platform.Name !== "twitch") {
			return {
				success: false,
				reply: `Adding me back to recently renamed channels is only available on Twitch!`
			};
		}

		/** @type {TwitchPlatform} */
		const platform = channelData.Platform;
		const newTwitchName = await platform.fetchUsernameByUserPlatformID(channelData.Specific_ID);
		if (!newTwitchName) {
			return {
			    success: false,
			    reply: "This channel doesn't seem to exist on Twitch anymore!"
			};
		}
		else if (newTwitchName !== channelData.Name) {
			const { exists } = await platform.fixChannelRename(channelData, newTwitchName, channelData.Specific_ID);
			if (exists) {
				return {
					success: false,
					reply: `The channel name ${newTwitchName} already exists in my database! Please contact @Supinic - this needs to be resolved manually.`
				};
			}
			else {
				return {
				    success: true,
				    reply: `Channel succesfully renamed: ${oldName} → ${newTwitchName}`
				};
			}
		}
		else {
			return {
			    success: true,
			    reply: "All good, nothing needs to be done."
			};
		}
	}
};
