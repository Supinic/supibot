const GptMessages = require("./gpt-messages.js");

module.exports = class GptNexra extends GptMessages {
	static async execute (context, query, modelData) {
		const response = await sb.Got("GenericAPI", {
			method: "POST",
			throwHttpErrors: false,
			url: "https://nexra.aryahcr.cc/api/chat/gpt",
			json: {
				model: modelData.url,
				prompt: query,
				markdown: false,
				top_p: 1,
				frequency_penalty: 0,
				presence_penalty: 0
			}
		});

		return { response };
	}

	static extractMessage (response) {
		return response.body.gpt;
	}

	static getUsageRecord () { return 0; }
	static getCompletionTokens () { return 0; }
	static getPromptTokens () { return 0; }
	static getProcessingTime () { return null; }

	static setHistory () {}
};
