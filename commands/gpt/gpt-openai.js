const config = require("./config.json");
const Template = require("./gpt-template.js");
const GptHistory = require("./history-control.js");

const partialInstructionRolloutChannels = [30, 37, 38];

module.exports = class GptOpenAI extends Template {
	static async getHistoryMode (context) {
		let historyMode = await context.user.getDataProperty("chatGptHistoryMode") ?? config.defaultHistoryMode;
		if (context.params.history) {
			const command = context.params.history;
			if (command === "ignore") {
				historyMode = "disabled";
			}
		}

		return { historyMode };
	}

	static async getHistory (context, query) {
		const { historyMode } = await GptOpenAI.getHistoryMode(context);
		const promptHistory = (historyMode === "enabled")
			? (await GptHistory.get(context.user) ?? [])
			: [];

		let systemMessage = "Keep the response as short and concise as possible.";
		if (context.params.context) {
			if (!context.channel) {
				throw new sb.Error({
					message: `This functionality is being rolled out, and as such, it is not available in private messages!`
				});
			}
			else if (!partialInstructionRolloutChannels.includes(context.channel.ID)) {
				throw new sb.Error({
					reply: `This functionality is being rolled out, and as such, it is not available in this channel!`
				});
			}

			systemMessage = context.params.context;
		}

		if (context.params.image) {
			return [
				{ role: "system", content: systemMessage },
				...promptHistory,
				{
					role: "user",
					content: [
						{ type: "text", text: query },
						{ type: "image_url", image_url: { url: context.params.image } }
					]
				}
			];
		}
		else {
			return [
				{ role: "system", content: systemMessage },
				...promptHistory,
				{ role: "user", content: query }
			];
		}
	}

	static async execute (context, query, modelData) {
		if (!process.env.API_OPENAI_KEY) {
			throw new sb.Error({
				messsage: "No OpenAI key configured (API_OPENAI_KEY)"
			});
		}

		let messages;
		try {
			messages = await GptOpenAI.getHistory(context, query);
		}
		catch (e) {
			return {
				success: false,
				reply: e.message
			};
		}

		const messagesLength = messages.reduce((acc, cur) => acc + cur.content.length, 0);
		const inputLimitCheck = super.checkInputLimits(modelData, messagesLength);
		if (inputLimitCheck.success === false) {
			await GptHistory.reset(context.user);

			messages = await GptOpenAI.getHistory(context, query);
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
				Authorization: `Bearer ${process.env.API_OPENAI_KEY}`
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

	static isAvailable () {
		return Boolean(process.env.API_OPENAI_KEY);
	}

	static async setHistory (context, query, reply) {
		const { historyMode } = await GptOpenAI.getHistoryMode(context);
		if (historyMode !== "enabled") {
			return;
		}

		if (context.params.image) {
			await GptHistory.imageAdd(context.user, query, context.params.image, reply);
		}
		else {
			await GptHistory.add(context.user, query, reply);
		}
	}

	static getRequestErrorMessage () {
		return `The OpenAI service is overloaded at the moment! Try again later.`;
	}
};
