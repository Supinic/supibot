const ChatGptConfig = require("./config.json");
module.exports = {
	Name: "gpt",
	Aliases: ["chatgpt"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Queries ChatGPT for a text response. Supports multiple models and parameter settings. Limited by tokens usage!",
	Flags: ["mention","non-nullable","pipe"],
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

		const modelData = ChatGptConfig.models[model.toLowerCase()];
		if (!modelData) {
			const names = Object.keys(ChatGptConfig.models).sort().join(", ");
			return {
				success: false,
				cooldown: 2500,
				reply: `Invalid ChatGPT model supported! Use one of: ${names}`
			};
		}

		if (query.length > ChatGptConfig.globalInputLimit) {
			return {
				success: false,
				cooldown: 2500,
				reply: `Maximum query length exceeded! ${query.length}/${ChatGptConfig.globalInputLimit}`
			};
		}
		else if (modelData.inputLimit && query.length > modelData.inputLimit) {
			return {
				success: false,
				cooldown: 2500,
				reply: sb.Utils.tag.trim `
					Maximum query length exceeded for this model!
					Shorten your query, or use a lower-ranked model instead.
					${query.length}/${modelData.inputLimit}
				`
			};
		}

		const { temperature } = context.params;
		if (typeof temperature === "number" && (temperature < 0 || temperature > 2)) {
			return {
				success: false,
				reply: `Your provided temperature is outside of the valid range! Use a value between 0.0 and 2.0 - inclusive.`,
				cooldown: 2500
			};
		}

		const limitCheckResult = await GptCache.checkLimits(context.user);
		if (limitCheckResult.success !== true) {
			return limitCheckResult;
		}

		let outputLimit = modelData.outputLimit.default;
		if (typeof customOutputLimit === "number") {
			if (!sb.Utils.isValidInteger(customOutputLimit)) {
				return {
					success: false,
					reply: `Your provided output limit must be a positive integer!`,
					cooldown: 2500
				};
			}

			const maximum = modelData.outputLimit.maximum;
			if (customOutputLimit > maximum) {
				return {
					success: false,
					cooldown: 2500,
					reply: `
						Maximum output limit exceeded for this model!
						Lower your limit, or use a lower-ranked model instead.
						${customOutputLimit}/${maximum}
					`
				};
			}

			outputLimit = customOutputLimit;
		}

		// @todo remove this try-catch and make the method return `null` with some param
		let userPlatformID;
		try {
			userPlatformID = context.platform.fetchInternalPlatformIDByUsername(context.user);
		}
		catch {
			userPlatformID = "N/A";
		}

		const { createHash } = require("crypto");
		const userHash = createHash("sha1")
			.update(context.user.Name)
			.update(context.platform.Name)
			.update(userPlatformID)
			.digest()
			.toString("hex");

		const prompt = `Query: ${query}\nAnswer: `;
		const response = await sb.Got("GenericAPI", {
			method: "POST",
			throwHttpErrors: false,
			url: `https://api.openai.com/v1/completions`,
			headers: {
				Authorization: `Bearer ${sb.Config.get("API_OPENAI_KEY")}`
			},
			json: {
				model: modelData.url,
				prompt,
				max_tokens: outputLimit,
				temperature: temperature ?? ChatGptConfig.defaultTemperature,
				top_p: 1,
				frequency_penalty: 0,
				presence_penalty: 0,
				user: userHash
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
		const [defaultModelName, defaultModelData] = Object.entries(ChatGptConfig.models).find(i => i[1].default === true);
		const { regular, subscriber } = ChatGptConfig.userTokenLimits;
		const { outputLimit } = ChatGptConfig;
		const basePriceModel = "Davinci";

		const modelListHTML = Object.entries(ChatGptConfig.models).map(([name, modelData]) => {
			const letter = name[0].toUpperCase();
			const defaultString = (modelData === defaultModelData)
				? " (default model)"
				: "";

			if (modelData.usageDivisor === 1) {
				return `<li><b>${sb.Utils.capitalize(name)}</b> (${letter})${defaultString}</li>`;
			}
			else {
				return `<li><b>${sb.Utils.capitalize(name)}</b> (${letter}) - ${modelData.usageDivisor}x cheaper than ${basePriceModel}${defaultString}</li>`;
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
			"There are four models you can choose from:",
			`<ul>${modelListHTML}</ul>`,

			"Each next model in succession is more powerful and more coherent than the previous, but also more expensive to use.",
			"When experimenting, consider using one of the lower tier models, only then moving up to higher tiers!",
			"For example: 100 tokens used in Davinci → 100 tokens used from your limit,",
			"but: 100 tokens used in Babbage (which is 40x cheaper) → 2.5 tokens used from your limit.",
			"",

			`You can also check out the <a href="https://beta.openai.com/docs/models/feature-specific-models">official documentation</a> of GPT-3 models on the official site for full info.`,
			"",

			"<h5>Basic usage</h5>",
			`<code>${prefix}gpt (your query)</code>`,
			`<code>${prefix}gpt What should I eat today?</code>`,
			"Queries ChatGPT for whatever you ask or tell it.",
			`This uses the <code>${sb.Utils.capitalize(defaultModelName)}</code> model by default.`,
			"",

			`<code>${prefix}gpt model:(name) (your query)</code>`,
			`<code>${prefix}gpt model:curie What should I name my goldfish?</code>`,
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
