module.exports = {
	Name: "gpt",
	Aliases: ["chatgpt"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Queries ChatGPT for a text response. Still being beta-tested! Coming to a chat near you, soon ™",
	Flags: ["mention","non-nullable","pipe","whitelist"],
	Params: [
		{ name: "model", type: "string" },
		{ name: "limit", type: "number" },
		{ name: "temperature", type: "number" }
	],
	Whitelist_Response: "Currently only available in these channels for testing: @pajlada @Supinic @Supibot",
	Static_Data: null,
	Code: (async function chatGPT (context, ...args) {
		const ChatGptConfig = require("./config.json");
		const GptCache = require("./cache-control.js");

		const query = args.join(" ");
		if (!query) {
			return {
				success: false,
				reply: "You have not provided any text!",
				cooldown: 2500
			};
		}

		const {
			limit: customOutputLimit,
			model = "davinci"
		} = context.params;

		if (!ChatGptConfig.models[model]) {
			const names = Object.keys(ChatGptConfig.models).sort().join(", ");
			return {
				success: false,
				reply: `Invalid ChatGPT model supported! Use one of: ${names}`
			};
		}

		if (query.length > ChatGptConfig.globalInputLimit) {
			return {
				success: false,
				reply: `Maximum query length exceeded! (${query.length}/${ChatGptConfig.globalInputLimit})`,
				cooldown: 2500
			};
		}

		const { temperature } = context.params;
		if (typeof temperature === "number" && (temperature < 0 || temperature > 2)) {
			return {
				success: false,
				reply: `Your provided temperature is outside of the valid range! Use a value between 0 and 1.`
			};
		}

		const modelData = ChatGptConfig.models[model];
		const limitCheckResult = await GptCache.checkLimits(context.user);
		if (limitCheckResult.success !== true) {
			return limitCheckResult;
		}

		let outputLimit = ChatGptConfig.outputLimit.default;
		if (typeof customOutputLimit === "number") {
			if (!sb.Utils.isValidInteger(customOutputLimit)) {
				return {
					success: false,
					reply: `Your provided output limit must be a positive integer!`
				};
			}
			else if (customOutputLimit > ChatGptConfig.outputLimit.maximum) {
				return {
					success: false,
					reply: `Your provided output limit must be lower than the maximum of ${ChatGptConfig.outputLimit.maximum} tokens`
				};
			}

			outputLimit = customOutputLimit;
		}

		const prompt = `Query: ${query}\nAnswer: `;
		const response = await sb.Got("GenericAPI", {
			method: "POST",
			throwHttpErrors: false,
			url: `https://api.openai.com/v1/engines/${modelData.url}/completions`,
			headers: {
				Authorization: `Bearer ${sb.Config.get("API_OPENAI_KEY")}`
			},
			json: {
				prompt,
				max_tokens: outputLimit,
				temperature: temperature ?? 0.75,
				top_p: 1,
				frequency_penalty: 0,
				presence_penalty: 0,
				user: context.user.Name
			}
		});

		if (!response.ok) {
			const logID = await sb.Logger.log(
				"Command.Warning",
				`ChatGPT API fail: ${response.statusCode} → ${JSON.stringify(response.body)}`,
				context.channel,
				context.user
			);

			if (response.statusCode === 429) {
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

		const { choices, usage } = response.body;
		await GptCache.addUsageRecord(context.user, usage.total_tokens, model);

		const [chatResponse] = choices;
		return {
			reply: `🤖 ${chatResponse.text.trim()}`
		};
	}),
	Dynamic_Description: (async (prefix) => {
		const ChatGptConfig = require("./config.json");
		const [defaultModelName, defaultModelData] = Object.entries(ChatGptConfig.models).find(i => i.default === true);
		const { regular, subscriber } = ChatGptConfig.userTokenLimits;
		const { outputLimit } = ChatGptConfig;

		const modelListHTML = Object.entries(ChatGptConfig.models).map(([name, modelData]) => {
			if (modelData === defaultModelData) {
				return `<li>${sb.Utils.capitalize(name)} (${letter})></li>`;
			}
			else {
				const letter = name[0].toUpperCase();
				return `<li>${sb.Utils.capitalize(name)} (${letter}) - ${modelData.usageDivisor}x cheaper than ${sb.Utils.capitalize(defaultModelName)}</li>`
			}
		}).join("");

		return [
			"Ask ChatGPT pretty much anything, and watch technology respond to you in various fun and interesting ways!",
			`Powered by <a href="https://openai.com/blog/chatgpt/">OpenAI's ChatGPT</a> using the <a href="https://en.wikipedia.org/wiki/GPT-3">GPT-3 language model</a>.`,
			"",

			"<h6>Limits</h6>",
			`ChatGPT works with "tokens". You have a specific amount of tokens you can use per hour and per day (24 hours).`,
			"If you exceed this limit, you will not be able to use the command until an hour (or a day) passes since your last command execution",
			`One hundred "tokens" vaguely correspond to about ~75 words, or about one paragraph, or one full Twitch message.`,
			"",

			"Both your input and output tokens will be tracked.",
			`You can check your current token usage with the <a href="/bot/command/detail/check">${prefix}check gpt</a> command.`,
			`If you would like to use the command more often and extend your limits, consider <a href="https://www.twitch.tv/products/supinic">subscribing</a> to me (@Supinic) for extended limits! All support is appreciated!`,
			"",

			`Regular limits: ${regular.hourly} tokens per hour, ${regular.daily} tokens per day.`,
			`Subscriber limits: ${subscriber.hourly} tokens per hour, ${subscriber.daily} tokens per day.`,
			"",

			"<h6>Models</h6>",
			"There are four models you can choose from:",
			`<ul>${modelListHTML}</ul>`,
			"",

			"Each next model in succession is more powerful and more coherent than the previous, but also more expensive to use.",
			"When experimenting, consider using one of the lower tier models, only then moving up to higher tiers!",
			"",

			"<h6>Basic usage</h6>",
			`<code>${prefix}gpt (your query)</code>`,
			`<code>${prefix}gpt What should I eat today?</code>`,
			"Queries ChatGPT for whatever you ask or tell it.",
			"This uses the <code>Davinci</code> model by default.",
			"",

			`<code>${prefix}gpt model:(name) (your query)</code>`,
			`<code>${prefix}gpt model:curie What should I name my goldfish?</code>`,
			"Queries ChatGPT with your selected model.",
			"",

			"<h6>Temperature</h6>",
			`<code>${prefix}gpt temperature:(numeric value) (your query)</code>`,
			`<code>${prefix}gpt temperature:0.5 What should I eat today?</code>`,
			`Queries ChatGPT with a specified "temperature" parameter.`,
			`Temperature is more-or-less understood to be "wildness" or "creativity" of the input.`,
			"The lower the value, the more predictable, but factual the response is.",
			"The higher the value, the more creative, unpredictable and wild the response becomes.",
			"",

			"<b>Warning!</b> Only temperature values between 0.0 and 1.0 are guaranteed to give you proper replies!.",
			"The command however supports temperature values all the way up to 2.0 - where you can receive completely garbled responses! Watch out for your token usage!",
			"",

			"<h6>Other</h6>",
			`<code>${prefix}gpt limit:(numeric value) (your query)</code>`,
			`<code>${prefix}gpt limit:25 (your query)</code>`,
			`Queries ChatGPT with a maximum limit on the response tokens.`,
			"By using this parameter, you can limit the response of ChatGPT to possibly preserve your usage tokens.",
			`The default token limit is ${outputLimit.default}, and you can specify a value between 0 and ${outputLimit.maximum}`,
			"",

			"<b>Warning!</b>This limit only applies to ChatGPT's <b>output</b>! You must control the length of your input query yourself."
		];
	})
};
