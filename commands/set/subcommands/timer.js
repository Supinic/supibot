const timersLimit = 5;
const timerNameRegex = /^[-\w\u00a9\u00ae\u2000-\u3300\ud83c\ud000-\udfff\ud83d\ud000-\udfff\ud83e\ud000-\udfff]{2,25}$/;

module.exports = {
	name: "timer",
	aliases: [],
	parameter: "arguments",
	description: "Sets/unsets a timer with a given name + date, which you can then check on later.",
	pipe: true,
	set: async (context, ...args) => {
		const timers = await context.user.getDataProperty("timers") ?? {};
		const name = args[0];
		if (!timerNameRegex.test(name)) {
			return {
				success: false,
				reply: `Your timer name is not valid! Your timer name should only contain letters, numbers and be 2-25 characters long.`
			};
		}

		let timersCount = Object.keys(timers).length;
		if (!timers[name]) {
			timersCount += 1;
		}

		if (timersCount > timersLimit) {
			return {
				success: false,
				reply: `You have too many timers set up! Unset one first.`
			};
		}

		const date = new sb.Date(args.slice(1, 2).filter(Boolean).join(" "));
		if (Number.isNaN(date.valueOf())) {
			return {
				success: false,
				reply: `Invalid date and/or time!`
			};
		}

		timers[name] = {
			date: date.valueOf()
		};

		await context.user.setDataProperty("timers", timers);
		return {
			reply: `Successfully added your timer "${name}".`
		};
	},
	unset: async (context, name) => {
		const timers = await context.user.getDataProperty("timers");
		if (!timers) {
			return {
				success: false,
				reply: `You don't have any timers set up!`
			};
		}
		else if (!timers[name]) {
			return {
				success: false,
				reply: `You don't have this timer set up!`
			};
		}

		delete timers[name];
		await context.user.setDataProperty("timers", timers);

		return {
			reply: `Successfully removed your timer "${name}".`
		};
	}
};
