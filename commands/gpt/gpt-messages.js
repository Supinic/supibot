const Config = require("./config.json");
const Template = require("./gpt-template.js");
const GptHistory = require("./history-control.js");

module.exports = class GptMessages extends Template {
	static async getHistoryMode (context) {
		let historyMode = await context.user.getDataProperty("chatGptHistoryMode") ?? Config.defaultHistoryMode;
		if (context.params.history) {
			const command = context.params.history;
			if (command === "ignore") {
				historyMode = "disabled";
			}
		}

		return { historyMode };
	}

	static async getHistory (context, query) {
		const { historyMode } = await GptMessages.getHistoryMode(context);
		const promptHistory = (historyMode === "enabled")
			? (await GptHistory.get(context.user) ?? [])
			: [];

		const systemMessages = [];
		if (context.params.debug) {
			const permissions = await context.getUserPermissions();
			if (!permissions.is("administrator")) {
				return {
					success: false,
					reply: `Debug mode is currently only available to administrators!`
				};
			}

			systemMessages.push({
				role: "system",
				content: context.params.debug
			});
		}
		else {
			systemMessages.push({
				role: "system",
				content: "Use a short summary, unless instructed."
			});
		}

		return [
			...systemMessages,
			...promptHistory,
			{ role: "user", content: query }
		];
	}

	static async execute (context, query, modelData) {
		let messages = await GptMessages.getHistory(context, query);
		const messagesLength = messages.reduce((acc, cur) => acc + cur.content.length, 0);

		const inputLimitCheck = super.checkInputLimits(modelData, messagesLength);
		if (inputLimitCheck.success === false) {
			await GptHistory.reset(context.user);

			messages = await GptMessages.getHistory(context, query);
			const messagesLength = messages.reduce((acc, cur) => acc + cur.content.length, 0);
			const repeatInputLimitCheck = super.checkInputLimits(modelData, messagesLength);
			if (repeatInputLimitCheck.success === false) {
				return repeatInputLimitCheck;
			}
		}

		const outputLimitCheck = super.determineOutputLimit(context, modelData);
		if (outputLimitCheck.success === false) {
			return outputLimitCheck;
		}
		const { outputLimit } = outputLimitCheck;

		const temperatureCheck = super.getTemperature(context);
		if (temperatureCheck.success === false) {
			return temperatureCheck;
		}
		const { temperature } = temperatureCheck;

		const response = await sb.Got("GenericAPI", {
			method: "POST",
			throwHttpErrors: false,
			url: `https://api.openai.com/v1/chat/completions`,
			headers: {
				Authorization: `Bearer ${sb.Config.get("API_OPENAI_KEY")}`
			},
			json: {
				model: modelData.url,
				messages,
				max_tokens: outputLimit,
				temperature,
				top_p: 1,
				frequency_penalty: 0,
				presence_penalty: 0,
				user: super.getUserHash(context)
			}
		});

		return { response };
	}

	static extractMessage (response) {
		return response.body.choices[0].message.content.trim();
	}

	static async setHistory (context, query, reply) {
		const { historyMode } = await GptMessages.getHistoryMode(context);
		if (historyMode === "enabled") {
			await GptHistory.add(context.user, query, reply);
		}
	}
};
