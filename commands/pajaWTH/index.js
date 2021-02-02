module.exports = {
	Name: "pajaWTH",
	Aliases: ["obamaWTF"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts a random Anthony \"Obama Chavez\" Stone quote, mostly from Knaked Knights and the snippets from IWF 2017.",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		quotes: [
			"When the Lord rises, even the mighty are terrified (Hirata 8:10)",
			"And he will love thee, and he will bless the fruit of thy womb (Reeves 364:364)",
			"Obama said to them, \"Come and have breakfast\" (Kaburera 19:19)",
			"None of the blobs ventured to question him, for it was the Lord (Kaburera 19:20)",
			"And they tempted God in their heart by asking breakfast for their lust (Chinkochicchai 114:514)",
			"Why the hell are you so late at getting home!?",
			"True bisexuals? That's not what the report says... You're gonna have to prove that...",
			"I'm sorry. I thought you were Edweina... Where is she?",
			"See? That wasn't so bad... What the hell?!",
			"Ugh! To think I could have had sex with the likes of you!",
			"Never, you frump!",
			"Get up, you lazy cow!",
			"Where's my breakfast?",
			"Don't get smart with me!",
			"While your mother's away it's your job to cook for me!",
			"Well that's just too fuckin' bad!",
			"Why do you need school for anyway?",
			"No one in their right fucking mind will ever hire a blob like you!",
			"Be quick about it!",
			"I'm gone now but it's okay...",
			"You're going to have to keep on living..."
		]
	})),
	Code: (async function pajaWTH () {
		return {
			reply: sb.Utils.randArray(this.staticData.quotes)
		};
	}),
	Dynamic_Description: null
};