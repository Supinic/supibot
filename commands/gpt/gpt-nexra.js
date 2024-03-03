const GptMessages = require("./gpt-messages.js");
const GptHistory = require("./history-control.js");

module.exports = class GptNexra extends GptMessages {
	static async getHistory (context) {
		const { historyMode } = await GptMessages.getHistoryMode(context);
		return (historyMode === "enabled")
			? (await GptHistory.get(context.user) ?? [])
			: [];
	}

	static async execute (context, query, modelData) {
		const messages = await this.getHistory(context);
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

		const index = response.body.indexOf("{");
		if (index === -1) {
			return {
				success: false,
				reply: `Nexra API returned an invalid response! Try again later.`
			};
		}

		try {
			response.body = JSON.parse(response.body.slice(index));
		}
		catch (e) {
			return {
				success: false,
				reply: `Nexra API returned an invalid response! Try again later.`
			};
		}

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

	static setHistory () {}
};
