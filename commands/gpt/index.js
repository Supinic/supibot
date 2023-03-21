module.exports = {
	Name: "gpt",
	Aliases: ["chatgpt"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Queries ChatGPT for a text response. Supports multiple models and parameter settings. Limited by tokens usage!",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "history", type: "string" },
		{ name: "model", type: "string" },
		{ name: "limit", type: "number" },
		{ name: "temperature", type: "number" }
	],
	Whitelist_Response: "Currently only available in these channels for testing: @pajlada @Supinic @Supibot",
	Static_Data: null,
	Code: (async function chatGPT (context, ...args) {
		const GptConfig = require("./config.json");
		const GptCache = require("./cache-control.js");
		const GptModeration = require("./moderation.js");

		const GptTemplate = require("./gpt-template.js");
		const GptMessages = require("./gpt-messages.js");
		const GptString = require("./gpt-string.js");

		const historyCommandResult = await GptTemplate.handleHistoryCommand(context);
		if (historyCommandResult) {
			return historyCommandResult;
		}

		const query = args.join(" ").trim();
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

		const Handler = (modelData.type === "messages")
			? GptMessages
			: GptString;

		const executionResult = await Handler.execute(context, query, modelData);
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

			if (response.statusCode === 429 && response.body.error.type === "insufficient_quota") {
				const { year, month } = new sb.Date();
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
		if (moderationResult.success === false) {
			return moderationResult;
		}

		await Handler.setHistory(context, query, reply);

		return {
			reply: `🤖 ${reply}`
		};
	}),
	Dynamic_Description: (async (prefix) => {
		const ChatGptConfig = require("./config.json");
		const [defaultModelName, defaultModelData] = Object.entries(ChatGptConfig.models).find(i => i[1].default === true);
		const { regular, subscriber } = ChatGptConfig.userTokenLimits;
		const { outputLimit } = ChatGptConfig;
		const basePriceModel = "Turbo";

		const modelListHTML = Object.entries(ChatGptConfig.models).map(([name, modelData]) => {
			const letter = name[0].toUpperCase();
			const capName = sb.Utils.capitalize(name);
			const defaultString = (modelData === defaultModelData)
				? " (default model)"
				: "";

			if (modelData.disabled) {
				return `<li><del><b>${capName}</b> (${letter})</del> - model is currently disabled: ${modelData.disableReason ?? "(N/A)"}</li>`;
			}
			else if (modelData.usageDivisor === 1) {
				return `<li><b>${capName}</b> (${letter}) ${defaultString}</li>`;
			}
			else {
				return `<li><b>${capName}</b> (${letter}) - ${modelData.usageDivisor}x cheaper than ${basePriceModel}${defaultString}</li>`;
			}
		}).join("");

		return [
			"Ask ChatGPT pretty much anything, and watch technology respond to you in various fun and interesting ways!",
			`Powered by <a href="https://openai.com/blog/chatgpt/">OpenAI's ChatGPT</a> using the <a href="https://en.wikipedia.org/wiki/GPT-3">GPT-3 language model</a>.`,
			"",

			"<h5>Limits</h5>",
			`ChatGPT works with "tokens". You have a specific amount of tokens you can use per hour and per day (24 hours).`,
			"If you exceed this limit, you will not be able to use the command until an hour (or a day) passes since your last command execution",
			`One hundred "tokens" vaguely correspond to about ~75 words, or about one paragraph, or one full Twitch message.`,
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
			`<ul>${modelListHTML}</ul>`,

			// "Each next model in succession is more powerful and more coherent than the previous, but also more expensive to use.",
			// "When experimenting, consider using one of the lower tier models, only then moving up to higher tiers!",
			// "For example: 100 tokens used in Davinci → 100 tokens used from your limit,",
			// "but: 100 tokens used in Babbage (which is 40x cheaper) → 2.5 tokens used from your limit.",
			// "",

			`You can also check out the <a href="https://beta.openai.com/docs/models/feature-specific-models">official documentation</a> of GPT-3 models on the official site for full info.`,
			"",

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
			"This command keeps the ChatGPT history, to allow for a conversation to happen.",
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
			"Resets all of your current prompt history.",
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
