const GptMessages = require("./gpt-messages.js");
const GptHistory = require("./history-control.js");

module.exports = class GptNexra extends GptMessages {
	static async getHistory (context) {
		const { historyMode } = await GptMessages.getHistoryMode(context);
		const promptHistory = (historyMode === "enabled")
			? (await GptHistory.get(context.user) ?? [])
			: [];

		let systemMessage = "Keep the response as short and concise as possible.";
		if (context.params.context) {
			systemMessage = context.params.context;
		}

		return [
			{ role: "system", content: systemMessage },
			...promptHistory
		];
	}

	static async execute (context, query, modelData) {
		const messages = await this.getHistory(context, query);
		const response = await sb.Got("GenericAPI", {
			method: "POST",
			throwHttpErrors: false,
			responseType: "text",
			url: "https://nexra.aryahcr.cc/api/chat/gpt",
			json: {
				messages,
				model: modelData.url,
				prompt: query,
				markdown: false,
				top_p: 1,
				frequency_penalty: 0,
				presence_penalty: 0
			}
		});

		let i = 0;
		const text = response.body;
		while (text[i] !== "{" || i > text.length) {
			i++;
		}

		if (text[i] !== "{") {
			return {
				success: false,
				reply: `Nexra API returned an invalid response!`
			};
		}

		response.body = JSON.parse(text.slice(i));

		return { response };
	}

	static extractMessage (response) {
		return response.body.gpt;
	}

	static getUsageRecord () { return 0; }
	static getCompletionTokens () { return 0; }
	static getPromptTokens () { return 0; }
	static getProcessingTime () { return null; }
	static isAvailable () { return true; }

	static async setHistory (context, query, reply) {
		const { historyMode } = await GptMessages.getHistoryMode(context);
		if (historyMode === "enabled") {
			await GptHistory.add(context.user, query, reply);
		}
	}
};
