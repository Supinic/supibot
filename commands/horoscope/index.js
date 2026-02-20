import { SupiDate } from "supi-core";
import zodiacData from "./zodiac.json" with { type: "json" };

export default {
	Name: "horoscope",
	Aliases: null,
	Author: "supinic",
	Cooldown: 30000,
	Description: "Checks a specific zodiac sign's horoscope. Can also check your horoscope, if you have set your birthday (day/month, not year) within Supibot.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function horoscope (context, inputZodiacName) {
		let zodiacName = null;
		let own = false;

		if (inputZodiacName) {
			const lowerInput = inputZodiacName.toLowerCase().trim();
			const zodiacObject = zodiacData.find(i => (
				i.name.toLowerCase() === lowerInput
				|| i.emoji === lowerInput
			));

			if (zodiacObject) {
				zodiacName = zodiacObject.name.toLowerCase();
			}
			else {
				return {
					success: false,
					reply: `Invalid zodiac sign provided! Either use a valid one, or you can set up your birthday with "${sb.Command.prefix}set birthday (birthday)" to automatically use your zodiac sign.`,
					cooldown: { length: 2500 }
				};
			}
		}
		else {
			const birthdayData = await context.user.getDataProperty("birthday");
			if (!birthdayData) {
				return {
					success: false,
					reply: `You don't have a birthday set up! Either set up your birthday with "${sb.Command.prefix}set birthday (birthday)" to automatically use your zodiac sign, or use a zodiac sign directly.`,
					cooldown: { length: 2500 }
				};
			}

			const { day, month } = birthdayData;
			for (const { start, end, name } of zodiacData) {
				if ((month === start[0] && day >= start[1]) || (month === end[0] && day <= end[1])) {
					zodiacName = name.toLowerCase();
					own = true;
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

		const response = await core.Got.get("GenericAPI")({
			responseType: "text",
			url: `https://www.astrology.com/horoscope/daily/${zodiacName}.html`
		});

		const html = response.body;
		const $ = core.Utils.cheerio(html);
		const node = $(".horoscope-content-wrapper > #content");

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

		// "Heuristic" that removes the last two sentences from the horoscope. This is aimed to slim down
		// the response, since it's usually a bit too long (around 600 characters) for Twitch (500 chars);
		const fullTextArray = node.text().trim().split(/\.\s/);
		const trimmedArray = (fullTextArray.length > 3)
			? fullTextArray.slice(0, -2)
			: fullTextArray;

		const trimmedText = trimmedArray.join(". ");
		const prefix = (own) ? "Your" : "";
		return {
			reply: `${prefix} ${core.Utils.capitalize(zodiacName)} horoscope for today: ${trimmedText}.`
		};
	}),
	Dynamic_Description: (async (prefix) => {
		const zodiacSignList = zodiacData.map(i => {
			const { start, end, name } = i;
			const startString = new SupiDate(2022, ...start).format("F jS");
			const endString = new SupiDate(2022, ...end).format("F jS");

			return `<li><code>${name}</code> (${startString} - ${endString})</li>`;
		}).join("");

		return [
			"Fetches a horoscope for either your zodiac sign, or one that you provide.",
			`To automatically use your horoscope, you should set your birthdate (only month + day) via the <a href="/bot/command/detail/set">set birthday</a> command`,
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
