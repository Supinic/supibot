module.exports = {
	Name: "randomlineextra",
	Aliases: ["rlx"],
	Author: "supinic",
	Last_Edit: "2020-10-04T23:03:41.000Z",
	Cooldown: 7500,
	Description: "Posts a random message from a special set of channels on Twitch. You should be able to identify the channel by its emoji.",
	Flags: ["block","pipe"],
	Whitelist_Response: null,
	Static_Data: (() => ({
		channels: {
			"amouranth": "💃🏼",
			"athenelive": "🇫🇷🤖",
			"drdisrespect": "💿",
			"drdisrespectlive": "💿",
			"ninja": "👤",
			"stpeach": "🍑",
			"alinity": "🍝👩💰",
			"p4wnyhof": "🇩🇪🤖",
			"pokimane": "😍"
		}
	})),
	Code: (async function randomLineExtra () {
		const [channel, emoji] = sb.Utils.randArray(Object.entries(this.staticData.channels));
		const max = (await sb.Query.getRecordset(rs => rs
			.select("MAX(ID) AS ID")
			.from("chat_line", channel)
			.single()
		));
	
		const line = (await sb.Query.getRecordset(rs => rs
			.select("Text")
			.from("chat_line", channel)
			.where("ID = %n", sb.Utils.random(1, max.ID))
			.single()
		));
	
		return {
			reply: `${emoji} ${line.Text}`
		};
	}),
	Dynamic_Description: null
};