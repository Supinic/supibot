export default {
	name: "repeat",
	aliases: [],
	description: "For the provided word or words, they will be repeated up to provided amount of times",
	examples: [
		["$abb repeat amount:5 hello", "hello hello hello hello hello"],
		["$abb repeat amount:3 hello world everyone", "hello world everyone hello world everyone hello world everyone"]
	],
	execute: (context, ...args) => {
		const { amount } = context.params;
		if (typeof amount !== "number") {
			return {
				success: false,
				reply: `No repeat amount provided!`
			};
		}
		else if (!core.Utils.isValidInteger(amount)) {
			return {
				success: false,
				reply: `The provided amount must be a positive integer!`
			};
		}

		// Add a space to the end of the query, to preserve words
		const query = `${args.join(" ")} `;
		if (/^\s+$/.test(query)) {
			return {
				success: false,
				reply: `You must provide something to repeat!`
			};
		}

		const limit = context.channel?.Message_Limit ?? context.platform.Message_Limit;
		const maximumRepeats = Math.trunc(limit / query.length);
		const actualRepeats = Math.min(amount, maximumRepeats);

		return {
			reply: query.repeat(actualRepeats)
		};
	}
};
