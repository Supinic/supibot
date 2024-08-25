const config = require("./config.json");
const History = require("./history-control.js");

module.exports = class GptTemplate {
	static checkInputLimits (modelData, queryLength) {
		if (modelData.inputLimit && queryLength > modelData.inputLimit) {
			const errorMessages = config.lengthLimitExceededMessage;
			return {
				success: false,
				cooldown: 2500,
				reply: `${errorMessages.history} ${queryLength}/${modelData.inputLimit}`
			};
		}
		else if (!modelData.inputLimit && queryLength > config.globalInputLimit) {
			return {
				success: false,
				cooldown: 2500,
				reply: `Maximum query length exceeded! ${queryLength}/${config.globalInputLimit}`
			};
		}

		return {
			success: true
		};
	}

	static determineOutputLimit (context, modelData) {
		const { limit } = context.params;
		let outputLimit = modelData.outputLimit.default;

		if (typeof limit === "number") {
			if (!sb.Utils.isValidInteger(limit)) {
				return {
					success: false,
					reply: `Your provided output limit must be a positive integer!`,
					cooldown: 2500
				};
			}

			const maximum = modelData.outputLimit.maximum;
			if (limit > maximum) {
				return {
					success: false,
					cooldown: 2500,
					reply: `
						Maximum output limit exceeded for this model!
						Lower your limit, or use a lower-ranked model instead.
						${limit}/${maximum}
					`
				};
			}

			outputLimit = limit;
		}

		return { outputLimit };
	}

	static getTemperature (context) {
		const { temperature } = context.params;
		if (typeof temperature === "number" && (temperature < 0 || temperature > 2)) {
			return {
				success: false,
				reply: `Your provided temperature is outside of the valid range! Use a value between 0.0 and 2.0 - inclusive.`,
				cooldown: 2500
			};
		}

		return { temperature };
	}

	static getUserHash (context) {
		// @todo remove this try-catch and make the method return `null` with some param
		let userPlatformID;
		try {
			userPlatformID = context.platform.fetchInternalPlatformIDByUsername(context.user);
		}
		catch {
			userPlatformID = "N/A";
		}

		const { createHash } = require("node:crypto");
		return createHash("sha1")
			.update(context.user.Name)
			.update(context.platform.Name)
			.update(userPlatformID)
			.digest()
			.toString("hex");
	}

	static getUsageRecord (response) {
		return response.body.usage.total_tokens;
	}

	static getPromptTokens (response) {
		return response.body.usage.prompt_tokens;
	}

	static getCompletionTokens (response) {
		return response.body.usage.completion_tokens;
	}

	static getProcessingTime (response) {
		if (!response.headers["openai-processing-ms"]) {
			return null;
		}

		return Number(response.headers["openai-processing-ms"]);
	}

	static isAvailable () {}

	static async handleHistoryCommand (context, query) {
		if (!context.params.history) {
			return;
		}

		const command = context.params.history;
		const historyMode = await context.user.getDataProperty("chatGptHistoryMode") ?? config.defaultHistoryMode;
		if (command === "enable" || command === "disable") {
			if (historyMode === command) {
				return {
					success: false,
					reply: `Your ChatGPT history is already ${command}d!`,
					cooldown: 2500
				};
			}

			const state = `${command}d`;
			await context.user.setDataProperty("chatGptHistoryMode", state);
			return {
				reply: `Your ChatGPT history was successfully ${command}d.`,
				cooldown: 5000
			};
		}
		else if (command === "clear" || command === "reset") {
			await History.reset(context.user);

			// If no query provided, return immediately. Otherwise, continue with cleared history as normal.
			if (!query) {
				return {
					reply: "Successfully cleared your ChatGPT history."
				};
			}
		}
		else if (command === "export" || command === "check") {
			return await History.dump(context.user);
		}
	}

	static async execute () {}

	static async extractMessage () {}

	static async setHistory () {}

	static getRequestErrorMessage () {
		return `The GPT service is overloaded at the moment! Try again later.`;
	}
};
