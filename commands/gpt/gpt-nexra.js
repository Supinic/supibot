const { setTimeout: wait } = require("node:timers/promises");

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

		const initResponse = await sb.Got.get("GenericAPI")({
			method: "POST",
			throwHttpErrors: false,
			responseType: "json",
			url: "https://nexra.aryahcr.cc/api/chat/gpt",
			json: {
				messages,
				model: modelData.url,
				prompt: query,
				markdown: false
			}
		});

		if (!initResponse.ok) {
			return {
				success: false,
				reply: `Nexra API returned an error! Try again later.`
			};
		}

		let response;
		let error;
		const taskId = initResponse.body.id;
		for (let i = 0; i < 30; i++) {
			const partialResponse = await sb.Got.get("GenericAPI")({
				method: "GET",
				throwHttpErrors: false,
				responseType: "json",
				url: `https://nexra.aryahcr.cc/api/chat/task/${encodeURIComponent(taskId)}`
			});

			const { status } = partialResponse.body;
			if (status === "pending") {
				await wait(1000);
			}
			else if (status === "error" || status === "not_found") {
				error = partialResponse;
				break;
			}
			else if (status === "completed") {
				response = partialResponse;
				break;
			}
		}

		if (error || !response) {
			console.warn("Nexra API failure", { error, response, context, query });
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
