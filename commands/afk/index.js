import afkDefinitions from "../../classes/afk-definitions.json" with { type: "json" };

const { invocations, specialSuffixes } = afkDefinitions;
const STATUS_LENGTH_CHARACTER_LIMIT = 2000;

export default {
	Name: "afk",
	Aliases: ["gn","brb","shower","food","lurk","poop","💩","work","study","nap"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Flags you as AFK. Supports a custom AFK message.",
	Flags: ["pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function afk (context, ...args) {
		if (context.privateMessage && sb.AwayFromKeyboard.get(context.user)) {
			return {
				success: false,
				reply: "You are already AFK!"
			};
		}

		const { invocation } = context;
		const target = invocations.find(i => i.name === invocation || i.aliases?.includes(invocation));

		let text = args.join(" ").trim();
		if (text.length === 0 && target.noTextString) {
			text = target.noTextString ?? "(no message)";
		}

		if (target.textSuffix) {
			text = `${text} ${target.textSuffix}`;
		}
		else if (target.specialSuffix) {
			const suffixes = specialSuffixes[target.specialSuffix] ?? [];
			const suffix = core.Utils.randArray(suffixes) ?? "";
			text = `${text} ${suffix}`;
		}

		await sb.AwayFromKeyboard.set(context.user, {
			Text: core.Utils.wrapString(text, STATUS_LENGTH_CHARACTER_LIMIT, { keepWhitespace: false }),
			Status: target.name ?? invocation,
			Silent: false,
			Interrupted_ID: null
		});

		return {
			partialReplies: [
				{
					bancheck: true,
					message: context.user.Name
				},
				{
					bancheck: false,
					message: `is ${target.status}: `
				},
				{
					bancheck: true,
					message: text
				}
			]
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Flags you as AFK (away from keyboard).",
		"While you are AFK, others can check if you are AFK.",
		"On your first message while AFK, the status ends and the bot will announce you coming back.",
		"Several aliases exist in order to make going AFK for different situations easier.",
		"",

		`<code>${prefix}afk (status)</code>`,
		`You are now AFK with the provided status`,
		``,

		`<code>${prefix}poop (status)</code>`,
		`You are now pooping.`,
		``,

		`<code>${prefix}brb (status)</code>`,
		`You will be right back.`,
		``,

		`and more - check the aliases`
	])
};
