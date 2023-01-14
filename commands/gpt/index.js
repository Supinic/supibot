module.exports = {
	Name: "gpt",
	Aliases: ["chatgpt"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Queries ChatGPT for a text response. Still being beta-tested! Coming to a chat near you, soon ™",
	Flags: ["mention","non-nullable","pipe","whitelist"],
	Params: [
		{ name: "model", type: "string" },
		{ name: "temperature", type: "number" }
	],
	Whitelist_Response: "Currently only available in these channels for testing: @pajlada @Supinic @Supibot",
	Static_Data: null,
	Code: (async function chatGPT (context, ...args) {
		const ChatGptConfig = require("./config.json");
		const query = args.join(" ");
		if (!query) {
			return {
				success: false,
				reply: "You have not provided any text!",
				cooldown: 2500
			};
		}

		const { model = "curie" } = context.params;
		if (!ChatGptConfig.models[model]) {
			const names = Object.keys(ChatGptConfig.models).sort().join(", ");
			return {
				success: false,
				reply: `Invalid ChatGPT model supported! Use one of: ${names}`
			};
		}

		const isPrivilegedChannel = (ChatGptConfig.ignoreLimitChannels.includes(context.channel.ID));
		const subscriberList = await sb.Cache.getByPrefix("twitch-subscriber-list-supinic");
		const isSubscribed = subscriberList.some(i => i.user_id === context.user.Twitch_ID);
		const modelData = ChatGptConfig.models[model];

		const modelInputLimit = modelData.inputLimit ?? ChatGptConfig.globalInputLimit;
		const applicableInputLimit = (isSubscribed || isPrivilegedChannel)
			? modelInputLimit
			: modelData.publicInputLimit ?? modelInputLimit;

		if (query.length > applicableInputLimit) {
			return {
				success: false,
				reply: `Maximum message length exceeded! (${query.length}/${applicableInputLimit})`,
				cooldown: 2500
			};
		}

		const { temperature } = context.params;
		if (typeof temperature === "number" && (temperature < 0 || temperature > 1)) {
			return {
				success: false,
				reply: `Your provided temperature is outside of the valid range! Use a value between 0 and 1.`
			};
		}

		const modelOutputLimit = modelData.outputLimit ?? ChatGptConfig.globalOutputLimit;
		const applicablOutputLimit = (isSubscribed || isPrivilegedChannel)
			? modelOutputLimit
			: modelData.publicOutputLimit ?? modelOutputLimit;

		const prompt = `Query: ${query}\nAnswer: `;
		const response = await sb.Got("GenericAPI", {
			method: "POST",
			url: `https://api.openai.com/v1/engines/${modelData.url}/completions`,
			headers: {
				Authorization: `Bearer ${sb.Config.get("API_OPENAI_KEY")}`
			},
			json: {
				prompt,
				max_tokens: applicablOutputLimit,
				temperature: temperature ?? 0.75,
				top_p: 1,
				frequency_penalty: 0,
				presence_penalty: 0,
				user: context.user.Name
			}
		});

		if (!response.ok) {
			if (response.statusCode === 429) {
				return {
					success: false,
					reply: `Exceeded maximum amount of uses for this month! Please try again later next month.`
				};
			}
			else {
				await sb.Logger.log(
					"Command.Warning",
					`GPT command warning: ${response.statusCode} → ${JSON.stringify(response.body)}`,
					context.channel,
					context.user
				);

				return {
					success: false,
					reply: `Something went wrong! Please let @Supinic know: status code ${response.statusCode}`
				};
			}
		}

		const [chatResponse] = response.body.choices;
		return {
			reply: `🤖 ${chatResponse.text.trim()}`
		};
	}),
	Dynamic_Description: (async () => ([
		"Currently being beta-tested! Coming to a chat near you, soon ™"
	]))
};
