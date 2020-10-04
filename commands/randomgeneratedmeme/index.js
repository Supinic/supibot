module.exports = {
	Name: "randomgeneratedmeme",
	Aliases: ["rgm"],
	Author: "supinic",
	Last_Edit: "2020-10-04T22:46:37.000Z",
	Cooldown: 10000,
	Description: "Posts the text of a randomly generated meme.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: (() => ({
		memes: [
			{
				"ID": 112126428,
				"name": "Distracted Boyfriend",
				"sfw": true
			},
			{
				"ID": 438680,
				"name": "Batman Slapping Robin",
				"sfw": true
			},
			{
				"ID": 87743020,
				"name": "Two Buttons",
				"sfw": true
			},
			{
				"ID": 181913649,
				"name": "Drake Hotline Bling",
				"sfw": true
			},
			{
				"ID": 61579,
				"name": "One Does Not Simply",
				"sfw": true
			},
			{
				"ID": 102156234,
				"name": "Mocking Spongebob",
				"sfw": true
			},
			{
				"ID": 93895088,
				"name": "Expanding Brain",
				"sfw": true
			},
			{
				"ID": 129242436,
				"name": "Change My Mind",
				"sfw": true
			},
			{
				"ID": 124822590,
				"name": "Left Exit 12 Off Ramp",
				"sfw": true
			},
			{
				"ID": 101470,
				"name": "Ancient Aliens",
				"sfw": true
			},
			{
				"ID": 89370399,
				"name": "Roll Safe Think About It",
				"sfw": true
			},
			{
				"ID": 61520,
				"name": "Futurama Fry",
				"sfw": true
			},
			{
				"ID": 1035805,
				"name": "Boardroom Meeting Suggestion",
				"sfw": true
			},
			{
				"ID": 4087833,
				"name": "Waiting Skeleton",
				"sfw": true
			},
			{
				"ID": 91538330,
				"name": "X, X Everywhere",
				"sfw": true
			},
			{
				"ID": 188390779,
				"name": "Woman Yelling At Cat",
				"sfw": true
			},
			{
				"ID": 119139145,
				"name": "Blank Nut Button",
				"sfw": true
			},
			{
				"ID": 61532,
				"name": "The Most Interesting Man In The World",
				"sfw": true
			},
			{
				"ID": 5496396,
				"name": "Leonardo Dicaprio Cheers",
				"sfw": true
			},
			{
				"ID": 155067746,
				"name": "Surprised Pikachu",
				"sfw": true
			},
			{
				"ID": 8072285,
				"name": "Doge",
				"sfw": true
			},
			{
				"ID": 97984,
				"name": "Disaster Girl",
				"sfw": true
			},
			{
				"ID": 100777631,
				"name": "Is This A Pigeon",
				"sfw": true
			},
			{
				"ID": 114585149,
				"name": "Inhaling Seagull",
				"sfw": true
			},
			{
				"ID": 131087935,
				"name": "Running Away Balloon",
				"sfw": true
			},
			{
				"ID": 124055727,
				"name": "Y'all Got Any More Of That",
				"sfw": true
			},
			{
				"ID": 21735,
				"name": "The Rock Driving",
				"sfw": true
			},
			{
				"ID": 28251713,
				"name": "Oprah You Get A",
				"sfw": true
			},
			{
				"ID": 563423,
				"name": "That Would Be Great",
				"sfw": true
			},
			{
				"ID": 101288,
				"name": "Third World Skeptical Kid",
				"sfw": true
			},
			{
				"ID": 123999232,
				"name": "The Scroll Of Truth",
				"sfw": true
			},
			{
				"ID": 27813981,
				"name": "Hide the Pain Harold",
				"sfw": true
			},
			{
				"ID": 134797956,
				"name": "American Chopper Argument",
				"sfw": true
			},
			{
				"ID": 6235864,
				"name": "Finding Neverland",
				"sfw": true
			},
			{
				"ID": 217743513,
				"name": "UNO Draw 25 Cards",
				"sfw": true
			},
			{
				"ID": 91545132,
				"name": "Trump Bill Signing",
				"sfw": true
			},
			{
				"ID": 101511,
				"name": "Don't You Squidward",
				"sfw": true
			},
			{
				"ID": 178591752,
				"name": "Tuxedo Winnie The Pooh",
				"sfw": true
			},
			{
				"ID": 61556,
				"name": "Grandma Finds The Internet",
				"sfw": true
			},
			{
				"ID": 14371066,
				"name": "Star Wars Yoda",
				"sfw": true
			},
			{
				"ID": 101287,
				"name": "Third World Success Kid",
				"sfw": true
			},
			{
				"ID": 84341851,
				"name": "Evil Kermit",
				"sfw": true
			},
			{
				"ID": 175540452,
				"name": "Unsettled Tom",
				"sfw": true
			},
			{
				"ID": 135256802,
				"name": "Epic Handshake",
				"sfw": true
			},
			{
				"ID": 161865971,
				"name": "Marked Safe From",
				"sfw": true
			},
			{
				"ID": 135678846,
				"name": "Who Killed Hannibal",
				"sfw": true
			},
			{
				"ID": 132769734,
				"name": "Hard To Swallow Pills",
				"sfw": true
			},
			{
				"ID": 196652226,
				"name": "Spongebob Ight Imma Head Out",
				"sfw": true
			}
		]
	})),
	Code: (async function randomGeneratedMeme () {
		if (!this.data.token || !this.data.cookie) {
			const { body, headers } = await sb.Got.instances.FakeAgent({
				method: "GET",
				url: "https://imgflip.com/ajax_get_le_data",
				responseType: "json"
			});
	
			this.data.token = body.__tok;
			this.data.cookie = headers["set-cookie"].find(i => i.includes("iflipsess"));
		}
	
		const { ID, name } = sb.Utils.randArray(this.staticData.memes);
		const { texts } = await sb.Got.instances.FakeAgent({
			method: "POST",
			url: "https://imgflip.com/ajax_ai_meme",
			headers: {
				"content-type": "application/x-www-form-urlencoded; charset=UTF-8",
				cookie: this.data.cookie
			},
			body: new sb.URLParams()
				.set("meme_id", ID)
				.set("init_text", "")
				.set("__cookie_enabled", "1")
				.set("__tok", this.data.token)
				.toString()
		}).json();
	
		return {
			reply: `${name}: ${texts.join(" - ")}`
		};	
	}),
	Dynamic_Description: null
};