module.exports = {
	Name: "randomlineextra",
	Aliases: ["rlx"],
	Author: "supinic",
	Cooldown: 7500,
	Description: "Posts a random message from a special set of channels on Twitch. You should be able to identify the channel by its emoji.",
	Flags: ["external-input","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		threshold: 10,
		channels: {
			athenelive: "🇫🇷🤖",
			drdisrespect: "💿",
			drdisrespectlive: "💿",
			stpeach: "🍑",
			alinity: "🍝👩💰",
			p4wnyhof: "🇩🇪🤖"
		}
	})),
	Code: (async function randomLineExtra () {
		const { channels, threshold } = this.staticData;
		const [channel, emoji] = sb.Utils.randArray(Object.entries(channels));

		const maxID = await sb.Query.getRecordset(rs => rs
			.select("MAX(ID) AS ID")
			.from("chat_line", channel)
			.single()
			.flat("ID")
		);

		let message;
		let i = 0;
		while (!message && i < threshold) {
			message = await sb.Query.getRecordset(rs => rs
				.select("Text")
				.from("chat_line", channel)
				.where("ID = %n", sb.Utils.random(1, maxID))
				.single()
				.limit(1)
				.flat("Text")
			);

			i++;
		}

		if (!message) {
			return {
				success: false,
				reply: "Could not roll a random line extra! Please try again."
			};
		}

		return {
			reply: `${emoji} ${message}`
		};
	}),
	Dynamic_Description: null
};
