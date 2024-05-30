module.exports = {
	name: "birthday",
	aliases: ["bday"],
	parameter: "arguments",
	description: "Lets you set your birthday (only day and month!) for use in other commands, like $horoscope. Use the MM-DD format (05-01 for May 1st), or \"may 1\", or \"1 may\".",
	flags: {
		pipe: false
	},
	set: async (context, ...args) => {
		const query = args.join(" ");
		if (!query) {
			return {
				success: false,
				reply: "No date provided!"
			};
		}

		const date = new sb.Date(query);
		if (Number.isNaN(date.valueOf())) {
			return {
				success: false,
				reply: "Date could not be parsed! Use the MM-DD format (e.g.: 05-01 for May 1st) if in doubt."
			};
		}

		const birthdayString = date.format("F jS");
		await context.user.setDataProperty("birthday", {
			month: date.month,
			day: date.day,
			string: birthdayString
		});

		return {
			reply: `Successfully set your birthday to ${birthdayString}.`
		};
	},
	unset: async (context) => {
		const birthdayData = await context.user.getDataProperty("birthday");
		if (!birthdayData) {
			return {
				success: false,
				reply: `You don't have a birthday date set up, so there is nothing to unset!`
			};
		}

		await context.user.setDataProperty("birthday", null);
		return {
			reply: "Your birthday date has been unset successfully!"
		};
	}
};
