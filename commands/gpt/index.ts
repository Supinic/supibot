import { SupiError } from "supi-core";
import { declare, type Context } from "../../classes/command.js";
import { typedEntries } from "../../utils/ts-helpers.js";

import rawGptConfig from "./config.json" with { type: "json" };
import GptConfigSchema from "./config-schema.js";
const GptConfig = GptConfigSchema.parse(rawGptConfig);

import GptCache from "./cache-control.js";
import { determineOutputLimit, handleHistoryCommand, type GptTemplate } from "./gpt-template.js";
import { GptOpenAI } from "./gpt-openai.js";
import { GptNexra, GptNexraComplements } from "./gpt-nexra.js";
import { GptDeepInfra } from "./gpt-deepinfra.js";
import { process as processMetrics } from "./metrics.js";
import { check as checkModeration } from "./moderation.js";

import setDefaultModelSubcommand from "../set/subcommands/default-gpt-model.js";

export type ModelName = keyof typeof rawGptConfig.models;
export type ModelData = {
	url: string;
	type: "openai" | "deepinfra" | "nexra" | "nexra-complements";
	default: boolean;
	disabled?: boolean;
	disableReason?: string;
	inputLimit: number;
	outputLimit: {
		default: number;
		maximum: number;
	};
	pricePerMtoken: number;
	flatCost?: number;
	subscriberOnly?: boolean;
	noSystemRole?: boolean;
	usesCompletionTokens?: boolean;
	search?: boolean;
};

const models = GptConfig.models;
const defaultModelEntry = typedEntries(models).find(i => i[1].default);
if (!defaultModelEntry) {
	throw new SupiError({
		message: "Assert error: $gpt has no default model"
	});
}

const defaultModelName = defaultModelEntry[0] as ModelName;
export const isModelName = (input: string): input is ModelName => Object.keys(GptConfig.models).includes(input);

const handlerMap = {
	openai: GptOpenAI,
	nexra: GptNexra,
	"nexra-complements": GptNexraComplements,
	deepinfra: GptDeepInfra
} as const;

let isLogTablePresent: boolean | null = null;
const params = [
	{ name: "context", type: "string" },
	{ name: "history", type: "string" },
	{ name: "image", type: "string" },
	{ name: "limit", type: "number" },
	{ name: "model", type: "string" },
	{ name: "temperature", type: "number" }
] as const;
export type GptContext = Context<typeof params>;

export default declare({
	Name: "gpt",
	Aliases: ["chatgpt"],
	Cooldown: 15000,
	Description: "Queries ChatGPT for a text response. Supports multiple models and parameter settings. Limited by tokens usage!",
	Flags: ["mention","non-nullable","pipe"],
	Params: params,
	Whitelist_Response: null,
	initialize: async function () {
		isLogTablePresent = await core.Query.isTablePresent("data", "ChatGPT_Log");
	},
	Code: (async function chatGPT (context, ...args) {
		const query = args.join(" ").trim();
		const historyCommandResult = await handleHistoryCommand(context, query);
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

		let modelName: ModelName;
		if (context.params.model) {
			const paramsModelName = context.params.model.toLowerCase();
			if (!isModelName(paramsModelName)) {
				const names = Object.keys(GptConfig.models).sort().join(", ");
				return {
					success: false,
					cooldown: 2500,
					reply: `Invalid ChatGPT model supported! Use one of: ${names}`
				};
			}

			modelName = paramsModelName;
		}
		else {
			const userDefaultModel = await context.user.getDataProperty("defaultGptModel");
			if (userDefaultModel) {
				if (!isModelName(userDefaultModel)) {
					return {
					    success: false,
					    reply: `Your saved model ${userDefaultModel} is no longer valid! Change it to a currently available one.`
					};
				}

				modelName = userDefaultModel;
			}
			else {
				modelName = defaultModelName;
			}
		}

		const modelData = models[modelName];
		if (modelData.disabled) {
			return {
				success: false,
				reply: `That model is currently disabled! Reason: ${modelData.disableReason ?? "(N/A)"}`
			};
		}
		else if (modelData.subscriberOnly === true) {
			const platform = sb.Platform.getAsserted("twitch");
			const isSubscribed = await platform.fetchUserAdminSubscription(context.user);
			if (!isSubscribed) {
				return {
					success: false,
					reply: "This model is only available to subscribers!"
				};
			}
		}

		const limitCheckResult = await GptCache.checkLimits(context.user);
		if (!limitCheckResult.success) {
			return limitCheckResult;
		}

		const Handler: GptTemplate = handlerMap[modelData.type];
		if (!Handler.isAvailable()) {
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
			if (core.Got.isRequestError(e)) {
				return {
					success: false,
					reply: Handler.getRequestErrorMessage()
				};
			}

			throw e;
		}

		if (!executionResult.success) {
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

			if (response.statusCode === 429 || response.statusCode >= 500) {
				return {
					success: false,
					reply: `The ChatGPT service is likely overloaded at the moment! Please try again later.`
				};
			}
			else {
				const idString = (logID) ? `Mention this ID: Log-${logID}` : "";
				return {
					success: false,
					reply: `Something unexpected wrong with the ChatGPT service! Please let @Supinic know. ${idString}`
				};
			}
		}

		const usageRecord = Handler.getUsageRecord(response);
		if (usageRecord !== null) {
			await GptCache.addUsageRecord(context.user, usageRecord, modelData);
		}

		const reply = Handler.extractMessage(context, response);
		if (typeof reply !== "string") {
			return {
				success: false,
				reply: `Could not generate GPT response! Try again later, or try a different model.`
			};
		}

		const moderationResult = await checkModeration(context, reply);

		let result;
		if (!moderationResult.success) {
			result = moderationResult;
		}
		else {
			await Handler.setHistory(context, query, reply);

			const outputLimitCheck = determineOutputLimit(context, modelData);
			const completionTokens = Handler.getCompletionTokens(response);

			let emoji = "🤖";
			if (outputLimitCheck.success && completionTokens !== null && completionTokens >= outputLimitCheck.outputLimit) {
				emoji = "⏳";
			}

			result = {
				reply: `${emoji} ${reply}`
			};
		}

		if (isLogTablePresent) {
			const row = await core.Query.getRow("data", "ChatGPT_Log");
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

		processMetrics({
			command: this,
			context,
			Handler,
			response,
			modelName,
			success: moderationResult.success
		});

		return result;
	}),
	Dynamic_Description: (prefix) => {
		const { regular, subscriber } = GptConfig.userTokenLimits;
		const { outputLimit } = GptConfig;

		const modelListHTML = typedEntries(models).map(([name, modelData]) => {
			const provider = modelData.type;
			const type = modelData.url.split("/").at(-1) ?? modelData.url;
			const isDefaultEmoji = (modelData.default) ? "✅" : "-";
			const isSearchableEmoji = (modelData.search === true) ? "✅" : "-";
			// const isSubscriberOnlyEmoji = (modelData.subscriberOnly === true) ? "✔" : "❌";

			let priceString = String(modelData.pricePerMtoken);
			if (modelData.flatCost) {
				priceString += ` + flat ${modelData.flatCost}`;
			}
			return core.Utils.tag.trim `
				<tr>
					<td>${name}</td>
					<td>${provider}</td>
					<td>${type}</td>
					<td>${priceString}</td>
					<td>${isDefaultEmoji}</td>
					<td>${isSearchableEmoji}</td>
				</tr>
			`;
		}).join("");

		const modelsTableHTML = core.Utils.tag.trim `
			<table>
				<thead>
					<th>Name</th>
					<th>Provider</th>
					<th>Type</th>
					<th>Pricing</th>
					<th>Default</th>
					<th>Online search</th>
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
			modelsTableHTML,

			"<h5>Basic usage</h5>",
			`<code>${prefix}gpt (your query)</code>`,
			`<code>${prefix}gpt What should I eat today?</code>`,
			"Queries ChatGPT for whatever you ask or tell it.",
			`This uses the <code>${core.Utils.capitalize(defaultModelName)}</code> model by default.`,
			"",

			`<code>${prefix}gpt model:(name) (your query)</code>`,
			`<code>${prefix}gpt model:turbo What should I name my goldfish?</code>`,
			"Queries ChatGPT with your selected model.",
			"",

			"<h5>Default model</h5>",
			`If you find yourself using a specific model a lot, you can set it as your "default model", which will then be used whenever you don't provide another model to be used.`,
			`For more info, see the <a href="/bot/command/detail/set">${prefix}set ${setDefaultModelSubcommand.name}</a> command.`,
			"",

			"<h5>Temperature</h5>",
			`<code>${prefix}gpt temperature:(numeric value) (your query)</code>`,
			`<code>${prefix}gpt temperature:0.5 What should I eat today?</code>`,
			`Queries ChatGPT with a specified "temperature" parameter.`,
			`Temperature is more-or-less understood to be "wildness" or "creativity" of the input.`,
			"The lower the value, the more predictable, but factual the response is.",
			"The higher the value, the more creative, unpredictable and wild the response becomes.",
			`By default, the temperature value is <code>${GptConfig.defaultTemperature}</code>.`,
			"",

			"<b>Important:</b> Only temperature values between 0.0 and 1.0 are guaranteed to give you proper replies.",
			"The command however supports temperature values all the way up to 2.0 - where you can receive completely garbled responses - which can be fun, but watch out for your token usage!",
			"",

			"<h5>History</h5>",
			"This command keeps the ChatGPT history, to allow for a conversation to happen.",
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
	}
});
