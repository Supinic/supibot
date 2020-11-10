module.exports = {
	Name: "forsenE",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Posts a random forsenE tweet.",
	Flags: ["pipe"],
	Whitelist_Response: null,
	Static_Data: (() => {
		this.data.previousPosts = [];
		return {
			repeats: 5,
			forsenE: [
				"Is the drdisrespect shooting connected to call of duty? Correct me if Im wrong but isn’t the scene just filled with wannabe thugs console shitters?",
				"Not sure if I formulated bad or people didnt get it. Im asking if its likely to be a hardcore call of duty nerd.",
				"That came with the 40-60k viewership increase. You always hear threaths and fights and shit go down in that community.",
				"amazon blocked my account",
				"now they want an bank statement that shows the given payment cards last 4 numbers to unlock the account. Swedish bank statements dont show that? Is that a normal thing?",
				"Prolly getting a mini fridge too for caffeine and snus. Would @redbullesports or @MonsterGaming like to sponsor me? Preferably Red bull since Monster tastes like ass.",
				"65 inch tv, mounted on wall or not ? what are some pros and cons. really slim sony one if that matters.",
				"b.",
				"does this bot just make shit up?",
				"cant register an account for hbonordic cause im not currently there. fml.",
				"No stream because Im out of snus today, Trust me , its for your own protection.",
				"yo guys, swapping my day off to today from friday so that I can listen to Rebecca Black tomorrow. bye",
				"@Cyborgmatt Yo, could you hook me up with a PBE account for TFT? would be cool :)",
				"Factorio should be more like Subnautica",
				"I remember @Sodapoppintv once said that he doesn’t want to take a piss at public event urinals because someone might come and snap a picture. I thought he was being silly. Actual 200 IQ.",
				"GFMB. We can only afford 1 headset. Money is tight. Thats why we are doing sponsored stream today.",
				"So my power just died right after the Ouija board answered “stop now” . Guess we are not playing that shit anymore.",
				"ISP being a cunt today. Ill be back tomorrow",
				"Twitch seems to be having some issues right now, pressed go live twice but no one can watch. will be back if they fix it",
				"oh and @AdmiralBulldog I'm coming for your ass ;)",
				"People malding over rerun streamers. Meanwhile I wake up thinking about playing a game for the first time in a long time. Stop obsessing over twitch and viewcounts and just play the game.",
				`Banned for 2 weeks for saying retarded russians instead of retarded "people who cant participate in voice comms in valorant due to legal reasons". I guess I have some more time to beat up my half russian siblings now. nice`,
				`Getting a new TV, any netflix and chillers out there know what to get? OS and shit thats useful in 2020. inb4 "tv in 2020 OMEGALUL"`,
				"random blue screen during world record run. unlucky"
			],
			notes: [
				`Source for the "b." tweet: https://twitter.com/Forsen/status/1057549668253659136`,
				`Source for the Cyborgmatt tweet (tweeted at DotA guy for access to league autochess) https://i.imgur.com/sILIqzj.png`,
				`Source for the GFMB quote: https://i.nuuls.com/umDfs.png`,
				"Source for the ban tweet: https://twitter.com/Forsen/status/1259936964272422917",
				"Source for the BSOD unlucky tweet: https://twitter.com/Forsen/status/1325185547220914176"
			]
		};
	}),
	Code: (async function forsenE () {
		const post = sb.Utils.randArray(this.staticData.forsenE.filter(i => !this.data.previousPosts.includes(i)));
		this.data.previousPosts.unshift(post);
		this.data.previousPosts.splice(this.staticData.repeats);
	
		return {
			reply: `${post} forsenE`
		};
	}),
	Dynamic_Description: null
};