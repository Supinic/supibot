const GptOpenAI = require("./gpt-openai.js");
const GptHistory = require("./history-control.js");

module.exports = class GptNexra extends GptOpenAI {
	static async getHistory (context) {
		const { historyMode } = await GptOpenAI.getHistoryMode(context);
		return (historyMode === "enabled")
			? (await GptHistory.get(context.user) ?? [])
			: [];
	}

	static async execute (context, query, modelData) {
		const messages = await this.getHistory(context);
		if (context.params.context) {
			messages.unshift({
				role: "user",
				content: context.params.context
			});
		}
		else {
			messages.unshift({
				role: "user",
				content: "Respond concisely, to the point, maximum 300 characters; unless I ask you for further detail."
			});
		}

		const response = await sb.Got.get("GenericAPI")({
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

		if (!response.ok) {
			return {
				success: false,
				reply: `Nexra API returned an error! Try again later.`
			};
		}

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

	static async setHistory (context, query, reply) {
		const { historyMode } = await GptOpenAI.getHistoryMode(context);
		if (historyMode === "enabled") {
			await GptHistory.add(context.user, query, reply);
		}
	}

	static getRequestErrorMessage () {
		return "Nexra is currently overloaded! Try again later.";
	}
};
