export default {
	Name: "raid-react-tts",
	Events: ["raid"],
	Description: "Reacts to Twitch raids with a TTS message",
	Code: (async function raidReactTts (context) {
		const { channel, user, username, data } = context;
		const amount = (data.viewers > 1000)
			? (String(core.Utils.round(data.viewers / 1000, 1)).replace(".", " point ") + " billion")
			: (data.viewers + " million");

		const message = `FeelsGoodMan Clap ${user?.Name ?? username} just raided the stream with ${amount} viewers!`;
		await channel.send(message);

		await core.Got.get("GenericAPI")({
			url: "http://192.168.1.100:9999",
			responseType: "text",
			searchParams: new URLSearchParams({
				tts: JSON.stringify([{
					locale: "en-us",
					text: message
				}])
			})
		});
	}),
	Global: false,
	Platform: null
};
