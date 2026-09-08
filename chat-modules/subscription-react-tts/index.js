const adjectives = [
	"",
	"Elite",
	"Premium",
	"Deluxe",
	"Exclusive",
	"Prestige",
	"Ultimate",
	"Supreme",
	"Royal",
	"VIP",
	"Platinum"
];

export default {
	Name: "sub-react-tts",
	Events: ["subscription"],
	Description: "Reacts to Twitch raids with a TTS message",
	Code: (async function raidReactTts (context) {
		const { channel, data, user } = context;

		const years = Math.floor(data.months / 12);
		const club = [adjectives[years], "Hackerman Club"].join(" ").trim();

		const name = data.recipient.Name;
		const recipient = data.recipient.Name.replace(/_/g, "");

		let message;
		let ttsMessage;
		if (data.gifted) {
			const gifter = user?.Name.replace(/_/g, "") ?? "Anonymous";
			message = `PogChamp Clap ${gifter} just gifted a sub to ${name}! Thanks for the gift, and ${name} - welcome to the ${club}! supiniHack`;
			ttsMessage = `${gifter} just gifted a sub to ${recipient}! Welcome to the ${club}!`;
		}
		else if (data.months > 1) {
			message = `PogChamp Clap ${name} just resubscribed for ${data.months} months! Welcome back to the ${club}!`
			ttsMessage = `${recipient} just resubscribed for ${data.months} months! Welcome to the ${club}!`;
		}
		else {
			message = `PogChamp Clap ${name} just subscribed! Welcome to the ${club}!`;
			ttsMessage = `${recipient} just subscribed! Welcome to the ${club}!`;
		}

		await channel.send(message);
		await core.Got.get("GenericAPI")({
			url: "http://192.168.1.100:9999",
			responseType: "text",
			searchParams: new URLSearchParams({
				tts: JSON.stringify([{
					locale: "en-us",
					text: ttsMessage
				}])
			})
		});
	}),
	Global: false,
	Platform: null
};
