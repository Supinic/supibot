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
	Code: (async function horoscope (context, inputZodiacName) {
		let zodiacName = null;
		const zodiacData = require("./zodiac.json");

		if (inputZodiacName) {
			const zodiacNames = zodiacData.map(i => i.name.toLowerCase());
			if (zodiacNames.includes(inputZodiacName.toLowerCase())) {
				zodiacName = inputZodiacName;
			}
			else {
				const prettyNames = zodiacNames.sort().map(i => sb.Utils.capitalize(i));
				return {
					success: false,
					reply: `Invalid zodiac sign provided! Use one of: ${prettyNames.join(", ")}`
				};
			}
		}
		else {
			const birthdayData = await context.user.getDataProperty("birthday");
			if (!birthdayData) {
				return {
					success: false,
					reply: `You don't have a birthday set up! Use "${sb.Command.prefix}set birthday (birthday)" command first.`,
					cooldown: { length: 2500 }
				};
			}

			const { day, month } = birthdayData;
			for (const { start, end, name } of zodiacData) {
				if ((month === start[0] && day >= start[1]) || (month === end[0] && day <= end[1])) {
					zodiacName = name;
					break;
				}
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
	Dynamic_Description: (async (prefix) => {
		const zodiacData = require("./zodiac.json");
		const zodiacSignList = zodiacData.map(i => {
			const { start, end, name } = i;
			const startString = new sb.Date(2022, ...start).format("F jS");
			const endString = new sb.Date(2022, ...end).format("F jS");

			return `<li><code>${name}</code> (${startString} - ${endString})</li>`;
		}).join("");

		return [
			"Fetches a horoscope for either your zodiac sign, or one that you provide.",
			`To automatically use your horoscope, you should set your birth date (only month + day) via the <a href="/bot/command/detail/set">set birthday</a> command`,
			"",

			`<code>${prefix}horoscope</code>`,
			"Uses your birthday's zodiac sign automatically.",
			"If you don't have one set up, this will not work - Supibot will ask you to fill out your birth date.",
			"",

			`<code>${prefix}horoscope (zodiac sign)</code>`,
			`<code>${prefix}horoscope aquarius</code>`,
			"Fetches today's horoscope for a provided zodiac sign.",
			"If you provide something that isn't a zodiac sign, this will not work - Supibot will post a list of properly spelled zodiac sign names.",
			"",

			"Zodiac sign list:",
			`<ul>${zodiacSignList}</ul>`
		];
	})
};
