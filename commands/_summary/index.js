const GptNexra = require("../gpt/gpt-nexra.js");

const BASE_MESSAGE = "Concisely summarize the following messages from an online chatroom: \n";

module.exports = {
	Name: "_summary",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "TODO",
	Flags: ["mention","pipe"],
	Params: [
		{ name: "channel", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function TODO (context) {
		if (context.platform.name !== "twitch") {
			return {
				success: false,
				reply: `Pepega TODO`
			};
		}

		const channel = context.params.channel ?? context.channel.Name;
		const { year, month, day } = new sb.Date(sb.Date.getTodayUTC());
		const url = `https://logs.ivr.fi/channel/${channel}/${year}/${month}/${day}`;

		const logsResponse = await sb.Got("GenericAPI", {
			url,
			throwHttpErrors: false,
			searchParams: {
				json: "1",
				reverse: "1",
				limit: "20"
			}
		});

		if (!logsResponse.ok) {
			return {
				success: false,
				reply: `Logs: oops`
			};
		}

		const gptData = logsResponse.body.messages
			.sort((a, b) => new sb.Date(a.timestamp) - new sb.Date(b.timestamp))
			.map(i => `${i.displayName}: ${i.text}`)
			.join("\n");

		const { response } = await GptNexra.execute(context, `${BASE_MESSAGE} ${gptData}`, {
			url: "gpt-4-32k"
		});

		if (!response.ok) {
			return {
				success: false,
				reply: `Nexra: oops`
			};
		}

		const message = GptNexra.extractMessage(response);
		return {
			reply: `Recent chat summary: ${message}`
		};
	}),
	Dynamic_Description: null
};
