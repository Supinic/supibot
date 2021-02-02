module.exports = {
	Name: "afk",
	Aliases: ["gn","brb","shower","food","lurk","poop","💩","ppPoof","work","study"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Flags you as AFK. Supports a custom AFK message.",
	Flags: ["pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		responses: {
			"afk": ["is no longer AFK"],
			"poop": ["is done taking a dump", "finished pooping", "forgot to flush", "washed hands", "didn't wash hands"],
			"brb": ["just got back", "hopped back", "- welcome back"],
			"food": ["finished eating", "is no longer stuffing their face", "is now full", "is done eating OpieOP describe taste"],
			"shower": ["is now squeaky clean", "finished showering"],
			"lurk": ["stopped lurking", "turned off the lurk mode"],
			"gn": ["just woke up", "finished their beauty sleep", "just got up"],
			"work": ["finished their work", "is taking a break from work", "finished working hard Kappa //"],
			"ppPoof": ["ppFoop materialized back", "ppFoop re-appeared", "ppFoop fooped back"],
			"study": ["is full of knowledge", "finished studying", "is now ready for the exam", "is fed up with studying", "is now smarter than most of the people in chat"]
		},
		foodEmojis: [
			"🍋", "🍞", "🥐", "🥖", "🥨", "🥯", "🥞", "🧀", "🍖", "🍗", "🥩", "🥓", "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯",
			"🥙", "🍳", "🥘", "🍲", "🥣", "🥗", "🍿", "🥫", "🍱", "🍘", "🍙", "🍚", "🍛", "🍜", "🍝", "🍠", "🍢", "🍣", "🍤",
			"🍥", "🍡", "🥟", "🥠", "🥡", "🍦", "🍧", "🍨", "🍩", "🍪", "🎂", "🍰", "🥧", "🍫", "🍬", "🍭", "🍮", "🍯"
		]
	})),
	Code: (async function afk (context, ...args) {
		if (context.privateMessage && sb.AwayFromKeyboard.data.find(i => i.User_Alias === context.user.ID)) {
			return {
				reply: "You are already AFK!"
			};
		}
	
		let text = args.join(" ").trim();
		let status = "now AFK";
	
		switch (context.invocation) {
			case "afk": [status, text] = ["now AFK", text || "(no message)"]; break;
			case "gn": [status, text] = ["now sleeping", (text ? (text + " 💤") : " 🛏💤")]; break;
			case "brb": [status, text] = ["going to be right back", text || "ppHop"]; break;
			case "shower": [status, text] = ["now taking a shower", (text ? (text + " 🚿") : " 🚿")]; break;
			
			case "💩":			
			case "poop": 
				context.invocation = "poop";
				[status, text] = ["now pooping", (text ?  (text + " 🚽") : "💩")]; 
				break;
	
			case "lurk": [status, text] = ["now lurking", (text ?  (text + " 👥") : " 👥")]; break;
			case "work": [status, text] = ["working", (text ?  (text + " 💼") : " 👷")]; break;
			case "ppPoof": [status, text] = ["ppPoof poofing away...", (text || "") + " 💨"]; break;
			case "study": [status, text] = ["now studying", (text || "🤓") + " 📚"]; break;
			case "food": {
				let useAutoEmoji = true;
				for (const emoji of this.staticData.foodEmojis) {
					if (text.includes(emoji)) {
						useAutoEmoji = false;
					}
				}
	
				const appendText = (useAutoEmoji)
					? sb.Utils.randArray(this.staticData.foodEmojis)
					: "";
	
				status = "now eating";
				text = (text) 
					? text + " " + appendText 
					: "OpieOP " + appendText;
				break;
			}
		}
		
		await sb.AwayFromKeyboard.set(context.user, text, context.invocation, false);
		return {
			partialReplies: [
				{
					bancheck: true,
					message: context.user.Name
				},
				{
					bancheck: false,
					message: `is ${status}:`
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