module.exports = {
	Name: "bing",
	Aliases: null,
	Author: "supinic",
	Cooldown: 30000,
	Description: "Queries Bing AI for a response.",
	Flags: ["mention"],
	Params: [
		{ name: "variant", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function bing (context, ...args) {
		const query = args.join(" ");
		if (!query) {
			return {
				cooldown: 2500,
				success: false,
				reply: `No text provided!`
			};
		}

		if (!this.data.client) {
			let Bing;
			try {
				Bing = await import("bing-chat");
			}
			catch (e) {
				return {
					success: false,
					reply: `The Bing chat module is currently not available!`
				};
			}

			const cookie = sb.Config.get("BING_AI_COOKIE", false);
			if (!cookie) {
				return {
					success: false,
					reply: `There is no Bing chat cookie configured!`
				};
			}

			this.data.client = new Bing.BingChat({ cookie });
		}

		let variant = "Balanced";
		if (context.params.variant) {
			const allowedVariants = ["creative", "balanced", "precise"];
			if (!allowedVariants.includes(context.params.variant.toLowerCase())) {
				return {
					cooldown: 2500,
					success: false,
					reply: `Invalid variant provided! Use one of: ${allowedVariants.join(", ")}`
				};
			}

			variant = sb.Utils.capitalize(context.params.variant);
		}

		const { check } = require("../gpt/moderation.js");
		const moderationCheck = await check(context, query);
		if (!moderationCheck.success) {
			return moderationCheck;
		}

		const mentionUsername = (context.getMentionStatus())
			? `${context.user.Name}, `
			: "";

		const { client } = this.data;
		const promise = new sb.Promise((resolve, reject) => {
			client.sendMessage(query, { variant })
				.then(i => resolve(i))
				.catch(e => reject(e))
				.finally(() => {
					for (const timeout of messageTimeouts) {
						clearTimeout(timeout);
					}
				});
		});

		const messageTimeouts = [
			setTimeout(() => promise.reject("Timeout reached"), 120_000)
		];

		for (const timeoutValue of [30, 60, 90]) {
			const timeout = setTimeout(
				() => context.sendIntermediateMessage(`${mentionUsername}${timeoutValue} seconds passed, still waiting ppCircle`),
				(timeoutValue * 1000)
			);

			messageTimeouts.push(timeout);
		}

		await context.sendIntermediateMessage(`${mentionUsername}Query started, now we wait ppCircle`);

		let result;
		try {
			result = await promise;
		}
		catch (e) {
			return {
				success: false,
				reply: `Bing API failed: ${e}`
			};
		}

		const { detail } = result;
		const text = [result.text, ""];
		if (detail.sourceAttributions.length > 0) {
			text.push(
				"Sources:",
				...detail.sourceAttributions.flatMap((i, ind) => [
					`[^${ind + 1}^]`,
					i.providerDisplayName,
					i.seeMoreUrl,
					""
				]),
				""
			);
		}

		const response = await sb.Got("GenericAPI", {
			method: "POST",
			url: `https://haste.zneix.eu/documents`,
			throwHttpErrors: false,
			body: text.join("\n")
		});

		return {
			reply: `https://haste.zneix.eu/raw/${response.body.key}`
		};
	}),
	Dynamic_Description: (async () => [])
};
