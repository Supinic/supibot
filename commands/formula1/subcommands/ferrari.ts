import untypedRadios from "./ferrari.json" with { type: "json" };
import type { FormulaOneSubcommandDefinition } from "../index.js";
import type { Channel } from "../../../classes/channel.js";

const radios: Radio[] = untypedRadios;
type Radio = {
	quote: string;
	driver: string;
	others: string | null;
	race: string | null;
	date: string | null;
	lap: number | null;
	link?: string;
};

const MAXIMUM_RADIO_REPEATS = 10;
const repeatedQuotes: Map<Channel["ID"] | "whispers", Radio[]> = new Map();

const subLevelCommands = ["link", "driver", "race"] as const;
const isSubLevelCommand = (input: string): input is typeof subLevelCommands[number] => (
	(subLevelCommands as readonly string[]).includes(input)
);

export default {
	name: "ferrari",
	aliases: ["ferari"],
	title: "Ferrari radios",
	default: false,
	description: [
		`<code>$f1 ferrari</code>`,
		"Posts a random Ferrari radio quote.",
		"",

		`<code>$f1 ferrari driver</code>`,
		"After a radio is posted, will show who was involved in it.",
		"",

		`<code>$f1 ferrari race</code>`,
		"After a radio is posted, will show what year and which race it happened at.",
		"",

		`<code>$f1 ferrari link</code>`,
		"After a radio is posted, will post a YouTube link to the specific moment (but only if available)"
	],
	execute: (context, subInvocation, type) => {
		const channelID = context.channel?.ID ?? "whispers";
		let repeatedArray = repeatedQuotes.get(channelID);
		if (!repeatedArray) {
			repeatedArray = [];
			repeatedQuotes.set(channelID, repeatedArray);
		}

		const previousRadio = repeatedArray.at(0);
		if (isSubLevelCommand(type)) {
			if (!previousRadio) {
				return {
					success: false,
					reply: "No radio has been checked in this channel just yet!"
				};
			}

			let result: string;
			switch (type) {
				case "link": {
					if (!previousRadio.link) {
						return {
							success: false,
							reply: "The last radio has no link associated with it!"
						};
					}

					result = `Link for the last posted radio: ${previousRadio.link}`;
					break;
				}
				case "driver": {
					result = `The last posted radio belongs to: ${previousRadio.driver}`;
					if (previousRadio.others) {
						result += ` and ${previousRadio.others}`;
					}

					break;
				}
				case "race": {
					if (!previousRadio.race) {
						return {
						    success: false,
						    reply: "The last radio has no race associated with it (yet)!"
						};
					}

					result = `The last posted was heard in: ${previousRadio.race}`;
					break;
				}
			}

			return {
			    success: true,
			    reply: result
			};
		}

		const availableRadios = radios.filter(i => !repeatedArray.includes(i));
		const radio = core.Utils.randArray(availableRadios);

		repeatedArray.unshift(radio);
		repeatedArray.splice(MAXIMUM_RADIO_REPEATS);

		return {
			success: true,
			reply: radio.quote
		};
	}
} satisfies FormulaOneSubcommandDefinition;
