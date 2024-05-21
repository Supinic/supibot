const GptCache = require("./cache-control.js");
const GptConfig = require("./config.json");
const GptMetrics = require("./metrics.js");
const GptModeration = require("./moderation.js");

const GptTemplate = require("./gpt-template.js");
const GptMessages = require("./gpt-messages.js");
const GptString = require("./gpt-string.js");
const GptNexra = require("./gpt-nexra.js");
const GptDeepInfra = require("./gpt-deepinfra.js");

const handlerMap = {
	messages: GptMessages,
	string: GptString,
	nexra: GptNexra,
	deepinfra: GptDeepInfra
};

let isLogTablePresent = null;

module.exports = {
	Name: "gpt",
	Aliases: ["chatgpt"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Queries ChatGPT for a text response. Supports multiple models and parameter settings. Limited by tokens usage!",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "context", type: "string" },
		{ name: "history", type: "string" },
		{ name: "model", type: "string" },
		{ name: "limit", type: "number" },
		{ name: "temperature", type: "number" }
	],
	Whitelist_Response: "Currently only available in these channels for testing: @pajlada @Supinic @Supibot",
	Static_Data: null,
	initialize: async function () {
		isLogTablePresent = await sb.Query.isTablePresent("data", "ChatGPT_Log");
	},
	Code: (async function chatGPT (context, ...args) {
		const query = args.join(" ").trim();
		const historyCommandResult = await GptTemplate.handleHistoryCommand(context, query);
		if (historyCommandResult) {
			return {
				...historyCommandResult,
				cooldown: 2500
			};
		}

		if (!query) {
			return {
				success: false,
				reply: "You have not provided any text!",
				cooldown: 2500
			};
		}

		const [defaultModelName] = Object.entries(GptConfig.models).find(i => i[1].default === true);
		const modelName = (context.params.model)
			? context.params.model.toLowerCase()
			: defaultModelName;

		const modelData = GptConfig.models[modelName];
		if (!modelData) {
			const names = Object.keys(GptConfig.models).sort().join(", ");
			return {
				success: false,
				cooldown: 2500,
				reply: `Invalid ChatGPT model supported! Use one of: ${names}`
			};
		}
		else if (modelData.disabled) {
			return {
				success: false,
				reply: `That model is currently disabled! Reason: ${modelData.disableReason ?? "(N/A)"}`
			};
		}

		const limitCheckResult = await GptCache.checkLimits(context.user);
		if (limitCheckResult.success !== true) {
			return limitCheckResult;
		}

		const Handler = handlerMap[modelData.type];
		if (!Handler) {
			return {
				success: false,
				reply: `No GPT handler found for type ${modelData.type}! Ensure the configuration is correct.`
			};
		}
		else if (!Handler.isAvailable()) {
			return {
				success: false,
				reply: `This model is not currently available! This is most likely due to incorrect configuration.`
			};
		}

		let executionResult;
		try {
			executionResult = await Handler.execute(context, query, modelData);
		}
		catch (e) {
			if (sb.Got.isRequestError(e)) {
				return {
					success: false,
					reply: `The OpenAI GPT service is overloaded at the moment! Try again later.`
				};
			}

			throw e;
		}

		if (executionResult.success === false) {
			return executionResult;
		}

		const { response } = executionResult;
		if (!response.ok) {
			const logID = await sb.Logger.log(
				"Command.Warning",
				`ChatGPT API fail: ${response.statusCode} → ${JSON.stringify(response.body)}`,
				context.channel,
				context.user
			);

			if (response.statusCode === 429 && response.body.error?.type === "insufficient_quota") {
				const { year, month } = new sb.Date(sb.Date.getTodayUTC());
				const nextMonthName = new sb.Date(year, month + 1, 1).format("F Y");
				const nextMonthDelta = sb.Utils.timeDelta(sb.Date.UTC(year, month + 1, 1));

				return {
					success: false,
					reply: sb.Utils.tag.trim `
						I have ran out of credits for the ChatGPT service for this month!
						Please try again in ${nextMonthName}, which will begin ${nextMonthDelta}
					`
				};
			}
			else if (response.statusCode === 429 || response.statusCode >= 500) {
				return {
					success: false,
					reply: `The ChatGPT service is likely overloaded at the moment! Please try again later.`
				};
			}
			else {
				const idString = (logID) ? `Mention this ID: Log-${logID}` : "";
				return {
					success: false,
					reply: `Something went wrong with the ChatGPT service! Please let @Supinic know. ${idString}`
				};
			}
		}

		await GptCache.addUsageRecord(context.user, Handler.getUsageRecord(response), modelName);

		const reply = Handler.extractMessage(response);
		const moderationResult = await GptModeration.check(context, reply);

		let result;
		if (moderationResult.success === false) {
			result = moderationResult;
		}
		else {
			await Handler.setHistory(context, query, reply);

			const { outputLimit } = Handler.determineOutputLimit(context, modelData);
			const completionTokens = Handler.getCompletionTokens(response);

			const emoji = (completionTokens >= outputLimit)
				? "⏳"
				: "🤖";

			result = {
				reply: `${emoji} ${reply}`
			};
		}

		if (isLogTablePresent) {
			const row = await sb.Query.getRow("data", "ChatGPT_Log");
			const inputTokens = Handler.getPromptTokens(response);
			const completionTokens = Handler.getCompletionTokens(response);

			row.setValues({
				User_Alias: context.user.ID,
				Channel: context.channel?.ID ?? null,
				Model: modelName,
				Query: query,
				Reply: reply,
				Parameters: (Object.keys(context.params).length > 0)
					? JSON.stringify(context.params)
					: null,
				Input_Tokens: inputTokens ?? 0,
				Output_Tokens: completionTokens ?? 0,
				Rejected: !(moderationResult.success)
			});

			await row.save({ skipLoad: true });
		}

		GptMetrics.process({
			command: this,
			context,
			Handler,
			response,
			modelData,
			success: moderationResult.success
		});

		return result;
	}),
	Dynamic_Description: (async (prefix) => {
		const ChatGptConfig = require("./config.json");
		const { regular, subscriber } = ChatGptConfig.userTokenLimits;
		const { outputLimit } = ChatGptConfig;

		let defaultModelName = "N/A";
		const modelListHTML = Object.entries(ChatGptConfig.models).map(([name, modelData]) => {
			let isDefaultEmoji = "❌";
			if (modelData.default) {
				defaultModelName = name;
				isDefaultEmoji = "✔";
			}

			return sb.Utils.tag.trim `
				<tr>
					<td>${name}</td>
					<td>${modelData.type}</td>
					<td>${modelData.pricePerMtoken}</td>
					<td>${isDefaultEmoji}</td>
				</tr>
			`;
		}).join("");

		const modelsTableHTML = sb.Utils.tag.trim `
			<table>
				<thead>
					<th>Name</th>
					<th>Type</th>
					<th>Pricing</th>
					<th>Default</th>
				</thead>
				<tbody>
					${modelListHTML}
				</tbody>
			</table>		
		`;

		return [
			"Ask ChatGPT pretty much anything, and watch technology respond to you in various fun and interesting ways!",
			`Powered by <a href="https://openai.com/blog/chatgpt/">OpenAI's ChatGPT</a> using the <a href="https://en.wikipedia.org/wiki/GPT-3">GPT-3 language model</a>.`,
			"",

			"<h5>Limits</h5>",
			`ChatGPT works with "tokens". You have a specific amount of tokens you can use per hour and per day (24 hours).`,
			"If you exceed this limit, you will not be able to use the command until an hour (or a day) passes since your last command execution",
			`One hundred "tokens" vaguely correspond to about ~75 words, or about one paragraph, or one full Twitch message.`,
			"If the message is cut short by the GPT limits, the hourglass ⌛ emoji will be shown at the beginning of the message.",
			"",

			"Both your input and output tokens will be tracked.",
			`You can check your current token usage with the <a href="/bot/command/detail/check">${prefix}check gpt</a> command.`,
			`If you would like to use the command more often and extend your limits, consider <a href="https://www.twitch.tv/products/supinic">subscribing</a> to me (@Supinic) on Twitch for extended limits! All support is appreciated!`,
			"",

			`Regular limits: ${regular.hourly} tokens per hour, ${regular.daily} tokens per day.`,
			`Subscriber limits: ${subscriber.hourly} tokens per hour, ${subscriber.daily} tokens per day.`,
			"",

			"<h5>Models</h5>",
			"Models you can choose from:",
			`${modelsTableHTML}`,

			"<h5>Basic usage</h5>",
			`<code>${prefix}gpt (your query)</code>`,
			`<code>${prefix}gpt What should I eat today?</code>`,
			"Queries ChatGPT for whatever you ask or tell it.",
			`This uses the <code>${sb.Utils.capitalize(defaultModelName)}</code> model by default.`,
			"",

			`<code>${prefix}gpt model:(name) (your query)</code>`,
			`<code>${prefix}gpt model:turbo What should I name my goldfish?</code>`,
			"Queries ChatGPT with your selected model.",
			"",

			"<h5>Temperature</h5>",
			`<code>${prefix}gpt temperature:(numeric value) (your query)</code>`,
			`<code>${prefix}gpt temperature:0.5 What should I eat today?</code>`,
			`Queries ChatGPT with a specified "temperature" parameter.`,
			`Temperature is more-or-less understood to be "wildness" or "creativity" of the input.`,
			"The lower the value, the more predictable, but factual the response is.",
			"The higher the value, the more creative, unpredictable and wild the response becomes.",
			`By default, the temperature value is <code>${ChatGptConfig.defaultTemperature}</code>.`,
			"",

			"<b>Important:</b> Only temperature values between 0.0 and 1.0 are guaranteed to give you proper replies.",
			"The command however supports temperature values all the way up to 2.0 - where you can receive completely garbled responses - which can be fun, but watch out for your token usage!",
			"",

			"<h5>History</h5>",
			"This command keeps the ChatGPT history for <b>messages</b> models, to allow for a conversation to happen.",
			"<b>String</b> models on the other hand, don't and can't support history.",
			"Your history is kept for 10 minutes since your last request, or until you delete it yourself.",
			"You can disable it, if you would like to preserve tokens or if you would prefer each prompt to be separate.",
			"",

			`<code>${prefix}gpt history:enable</code>`,
			`<code>${prefix}gpt history:disable</code>`,
			"Disables or enables the history keeping of your ChatGPT prompts.",
			"",

			`<code>${prefix}gpt history:ignore What should I eat today?</code>`,
			"Disables the keeping of history for a single prompt, without setting its default mode.",
			"",

			`<code>${prefix}gpt history:clear</code>`,
			`<code>${prefix}gpt history:reset</code>`,
			`<code>${prefix}gpt history:clear (your query)</code>`,
			"Resets all of your current prompt history.",
			"If you provide any text along with this parameter, your history is cleared and a new prompt is started immediately.",
			"",

			`<code>${prefix}gpt history:export</code>`,
			`<code>${prefix}gpt history:check</code>`,
			"Posts a link with your current prompt history as text.",
			"",

			"<h5>Other</h5>",
			`<code>${prefix}gpt limit:(numeric value) (your query)</code>`,
			`<code>${prefix}gpt limit:25 (your query)</code>`,
			`Queries ChatGPT with a maximum limit on the response tokens.`,
			"By using this parameter, you can limit the response of ChatGPT to possibly preserve your usage tokens.",
			`The default token limit is ${outputLimit.default}, and you can specify a value between 1 and ${outputLimit.maximum}.`,
			"",

			"<b>Warning!</b> This limit only applies to ChatGPT's <b>output</b>! You must control the length of your input query yourself."
		];
	})
};
