import { SupiDate } from "supi-core";
import type { CommandDefinition, Context, ContextPlatformSpecificData } from "../../classes/command.js";
import type { MessageData as TwitchMessageData } from "../../platforms/twitch.js";

const platformHasMessageId = (input: ContextPlatformSpecificData): input is TwitchMessageData => {
	if (!input) {
		return false;
	}

	return Object.hasOwn(input, "id");
};

const REPEATED_NUMBERS_NAMES = new Map([
	[2, "dubs"],
	[3, "trips"],
	[4, "quads"],
	[5, "quints"],
	[6, "sexes"],
	[7, "septs"],
	[8, "octs"],
	[9, "nons"],
	[10, "decs"]
]);

export default {
	Name: "checkem",
	Aliases: ["CheckEm", "check'em"],
	Cooldown: 10_000,
	Description: "Similar to 4chan, posts the ID of your message as a number. Then, it checks it for dubs and higher.",
	Flags: ["mention", "pipe", "skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Code: function checkEm (context: Context<[]>) {
		if (!context.channel) {
			return {
			    success: false,
			    reply: "This command is not available in private messages!"
			};
		}

		const messageData = context.platformSpecificData;
		if (!platformHasMessageId(messageData)) {
			return {
				success: false,
				reply: `This command is not available on ${context.platform.capital}!`
			};
		}

		const pseudoUuid = messageData.id.replaceAll("-", "");
		const messageNumber = BigInt(`0x${pseudoUuid}`);

		const croppedNumber = String(messageNumber).slice(0, 12);
		const list = croppedNumber.split("");
		const repeatedDigit = list.pop();

		let repeatsAmount = 1;
		let currentDigit = list.pop();
		while (currentDigit === repeatedDigit) {
			repeatsAmount++;
			currentDigit = list.pop();
		}

		const cooldown = {
			length: this.Cooldown,
			user: context.user.ID,
			channel: null,
			platform: null
		};

		if (repeatsAmount === 1) {
			return {
				reply: croppedNumber,
				cooldown
			};
		}

		const checkEmName = REPEATED_NUMBERS_NAMES.get(repeatsAmount);
		if (repeatsAmount > 2) {
			console.log(`${checkEmName}!`, new SupiDate(), context.channel.Name, context.user.Name);
		}

		if (!checkEmName) {
			return {
				reply: `${croppedNumber} - you got more than 10 repeating digits?! Big gratz!`,
				cooldown
			};
		}

		return {
			reply: `${croppedNumber} - VisLaud Clap Congratulations on the ${checkEmName}!`,
			cooldown
		};
	},
	Dynamic_Description: null
} satisfies CommandDefinition;
