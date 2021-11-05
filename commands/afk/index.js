module.exports = {
	Name: "afk",
	Aliases: ["gn","brb","shower","food","lurk","poop","💩","ppPoof","work","study"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Flags you as AFK. Supports a custom AFK message.",
	Flags: ["pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (command => ({
		statusLengthLimit: 2000,

		responses: {
			afk: ["is no longer AFK"],
			poop: ["is done taking a dump", "finished pooping", "forgot to flush", "washed hands", "didn't wash hands"],
			brb: ["just got back", "hopped back", "- welcome back"],
			food: ["finished eating", "is no longer stuffing their face", "is now full", "is done eating OpieOP describe taste"],
			shower: ["is now squeaky clean", "finished showering"],
			lurk: ["stopped lurking", "turned off the lurk mode"],
			gn: ["just woke up", "finished their beauty sleep", "just got up"],
			work: ["finished their work", "is taking a break from work", "finished working hard Kappa //"],
			ppPoof: ["ppFoop materialized back", "ppFoop re-appeared", "ppFoop fooped back"],
			study: ["is full of knowledge", "finished studying", "is now ready for the exam", "is fed up with studying", "is now smarter than most of the people in chat"]
		},
		/* eslint-disable array-element-newline */
		foodEmojis: [
			"🍋", "🍞", "🥐", "🥖", "🥨", "🥯", "🥞", "🧀", "🍖", "🍗", "🥩", "🥓", "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯",
			"🥙", "🍳", "🥘", "🍲", "🥣", "🥗", "🍿", "🥫", "🍱", "🍘", "🍙", "🍚", "🍛", "🍜", "🍝", "🍠", "🍢", "🍣", "🍤",
			"🍥", "🍡", "🥟", "🥠", "🥡", "🍦", "🍧", "🍨", "🍩", "🍪", "🎂", "🍰", "🥧", "🍫", "🍬", "🍭", "🍮", "🍯"
		],
		/* eslint-enable array-element-newline */

		invocations: [
			{
				name: "afk",
				status: "now AFK",
				text: (context, text) => text || "(no message)"
			},
			{
				name: "gn",
				status: "now sleeping",
				text: (context, text) => (text) ? `${text} 💤` : " 🛏💤"
			},
			{
				name: "brb",
				status: "going to be right back",
				text: async (context, text) => text || await context.getBestAvailableEmote(["ppHop", "ppSlide"], "⌛")
			},
			{
				name: "shower",
				status: "now taking a shower",
				text: (context, text) => {
					if (text) {
						return `${text} 🚿`;
					}

					if (sb.Utils.random(1, 100) === 1) {
						return " 🐏🏡 🤠🚿";
					}
					else {
						return " 😏🚿";
					}
				}
			},
			{
				name: "poop",
				aliases: ["💩"],
				type: "poop",
				status: "now pooping",
				text: async (context, text) => (text) ? `${text} 🚽` : await context.getBestAvailableEmote(["peepoPooPoo"], "💩")
			},
			{
				name: "lurk",
				status: "now lurking",
				text: (context, text) => (text) ? `${text} 👥` : "👥"
			},
			{
				name: "work",
				status: "working",
				text: (context, text) => (text) ? `${text} 💼` : " 👷"
			},
			{
				name: "ppPoof",
				status: "now poofing away",
				text: (context, text) => `${text ?? ""} 💨`
			},
			{
				name: "study",
				status: "now studying",
				text: (context, text) => `${text ?? "🤓"}📚`
			},
			{
				name: "food",
				status: "now eating",
				text: async (context, text) => {
					let useAutoEmoji = true;
					for (const emoji of command.staticData.foodEmojis) {
						if (text.includes(emoji)) {
							useAutoEmoji = false;
						}
					}

					const emote = await context.getBestAvailableEmote(["OpieOP"], "😋");
					const appendText = (useAutoEmoji)
						? sb.Utils.randArray(command.staticData.foodEmojis)
						: "";

					return (text) ? `${text} ${appendText}` : `${emote} ${appendText}`;
				}
			}
		]
	})),
	Code: (async function afk (context, ...args) {
		if (context.privateMessage && sb.AwayFromKeyboard.get(context.user)) {
			return {
				success: false,
				reply: "You are already AFK!"
			};
		}

		const { invocation } = context;
		const target = this.staticData.invocations.find(i => i.name === invocation || i.aliases?.includes(invocation));

		const text = await target.text(context, args.join(" ").trim());
		await sb.AwayFromKeyboard.set(context.user, {
			Text: sb.Utils.wrapString(text, this.staticData.statusLengthLimit, { keepWhitespace: false }),
			Status: target.type ?? invocation,
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
