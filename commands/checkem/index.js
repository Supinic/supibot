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
	Aliases: ["CheckEm","check'em"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Similar to 4chan, posts the ID of your message as a number. Then, it checks it for dubs and higher.",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function checkEm (context) {
		let messageNumber;
		const messageData = context.platformSpecificData;
		if (typeof messageData?.id === "string") {
			const pseudoUuid = messageData.id.replaceAll("-", "");
			messageNumber = BigInt(`0x${pseudoUuid}`);
		}
		else {
			return {
				success: false,
				reply: `This command is not available on ${context.platform.capital}!`
			};
		}

		const croppedNumber = String(messageNumber).slice(-12);
		const list = [...croppedNumber];
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
			console.log(`${checkEmName}!`, new sb.Date(), context.channel.Name, context.user.Name);
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
	}),
	Dynamic_Description: null
};
