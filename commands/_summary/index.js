const GptNexra = require("../gpt/gpt-nexra.js");

const RAW_TEXT_REGEX = /^\[(?<date>[\d-\s:]+)]\s+#\w+\s+(?<username>\w+):\s+(?<message>.+?)$/;
const BASE_MESSAGE = "Concisely summarize the following messages from an online chatroom: \n";
const RUSTLOG_RESPONSES = {
	403: "That channel has opted out from being logged!",
	404: "That channel is not being logged at the moment!",
	default: "Unspecified error occured! Try again later."
};

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
	Code: (async function TODO (context, channelInput) {
		let channel = channelInput;
		if (!channel) {
			if (context.platform.name !== "twitch") {
				return {
					success: false,
					reply: `Pepega TODO`
				};
			}

			channel = context.channel.Name;
		}

		const twitch = sb.Platform.get("twitch");
		const channelId = await twitch.getUserID(channel);
		if (!channelId) {
			return {
				success: false,
				reply: `No user TODO`
			};
		}

		const { year, month, day } = new sb.Date(sb.Date.getTodayUTC());
		const url = `https://logs.ivr.fi/channelid/${channelId}/${year}/${month}/${day}`;
		const logsResponse = await sb.Got("GenericAPI", {
			url,
			throwHttpErrors: false,
			responseType: "text",
			searchParams: {
				reverse: "1",
				limit: "20"
			}
		});

		if (!logsResponse.ok) {
			return {
				success: false,
				reply: RUSTLOG_RESPONSES[logsResponse.statusCode] ?? RUSTLOG_RESPONSES.default
			};
		}

		const gptData = logsResponse.body
			.split(/\r?\n/)
			.map(i => i.match(RAW_TEXT_REGEX))
			.filter(Boolean)
			.sort((a, b) => new sb.Date(a.date) - new sb.Date(b.date))
			.map(i => `${i.username}: ${i.message}`)
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
