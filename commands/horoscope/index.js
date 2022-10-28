module.exports = {
	Name: "horoscope",
	Aliases: null,
	Author: "supinic",
	Cooldown: 30000,
	Description: "Checks your horoscope, if you have set your birthday within Supibot.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function horoscope (context) {
		const birthdayData = await context.user.getDataProperty("birthday");
		if (!birthdayData) {
			return {
				success: false,
				reply: `You don't have a birthday set up! Use "${sb.Command.prefix}set birthday (birthday)" command first.`,
				cooldown: { length: 2500 }
			};
		}

		let zodiacName = null;
		const zodiacData = require("./zodiac.json");
		const { day, month } = birthdayData;

		for (const { start, end, name } of zodiacData) {
			if ((month === start[0] && day >= start[1]) || (month === end[0] && day <= end[1])) {
				zodiacName = name;
				break;
			}
		}

		if (zodiacName === null) {
			return {
				success: false,
				reply: `No zodiac sign detected...?`
			};
		}

		const response = await sb.Got("FakeAgent", {
			// Zodiac signs must be lowercased as the website skips the horoscope summary if the zodiac is capitalized
			url: `https://www.ganeshaspeaks.com/horoscopes/daily-horoscope/${zodiacName.toLowerCase()}`,
			responseType: "text"
		});

		const $ = sb.Utils.cheerio(response.body);
		const node = $("#horo_content");
		if (node.length === 0) {
			return {
				success: false,
				reply: `No horoscope is currently available for this zodiac sign!`
			};
		}
		else if (node.length > 1) {
			return {
				success: false,
				reply: `Received horoscope data is invalid!`
			};
		}

		return {
			reply: `Your ${zodiacName} horoscope for today: ${node.text()}`
		};
	}),
	Dynamic_Description: null
};
