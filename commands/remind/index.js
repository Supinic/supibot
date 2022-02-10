module.exports = {
	Name: "remind",
	Aliases: ["notify","remindme","remindprivate","privateremind"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Sets a notify for a given user. Can also set a time to ping that user (or yourself) in given amount of time, but in that case you must use the word \"in\" and then a number specifying the amount days, hours, minutes, etc.",
	Flags: ["block","mention","opt-out","pipe","use-params"],
	Params: [
		{ name: "at", type: "string" },
		{ name: "on", type: "string" },
		{ name: "private", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		limit: 2000,
		strings: {
			"scheduled-incoming": "That person has too many timed reminders pending for them on that day!",
			"scheduled-outgoing": "You have too many timed reminders pending on that day!",
			"public-incoming": "That person has too many public reminders pending!",
			"public-outgoing": "You have too many public reminders pending!",
			"private-incoming": "That person has too many private reminders pending!",
			"private-outgoing": "You have too many private reminders pending!"
		},
		sqlDateLimit: new sb.Date(253402297199999) // SQL DATETIME limit - 9999-12-31 23:59:59.999
	})),
	Code: (async function remind (context, ...args) {
		const hasChrono = Boolean(context.params.at ?? context.params.on);
		if (!hasChrono && args.length === 0) {
			return {
				success: false,
				reply: `Incorrect syntax! Use "remind (person) (text)"`,
				cooldown: 2500
			};
		}

		let targetUser = (args[0])
			? await sb.User.get(args[0], true)
			: null;

		if (context.invocation.includes("me") || args[0] === "me" || (targetUser && targetUser.ID === context.user.ID)) {
			targetUser = context.user;

			if (!context.invocation.includes("me")) {
				args.shift();
			}
		}
		else if (!targetUser) {
			return {
				success: false,
				reply: "An invalid user was provided!",
				cooldown: this.Cooldown / 2
			};
		}
		else if (targetUser.Name === context.platform.Self_Name) {
			return {
				success: false,
				reply: `I'm always here, so you don't have to ${context.invocation} me! :)`,
				cooldown: this.Cooldown / 2
			};
		}
		else {
			args.shift();
		}

		const spotted = await sb.Query.getRecordset(rs => rs
			.select("1")
			.from("chat_data", "Message_Meta_User_Alias")
			.where("User_Alias = %n", targetUser.ID)
			.limit(1)
			.single()
			.flat("1")
		);

		if (!spotted) {
			return {
				success: false,
				reply: `I have never seen this user in chat before, so I cannot remind them!`
			};
		}

		let isPrivate = Boolean(context.invocation.includes("private") || context.params.private);
		if (isPrivate && context.channel !== null) {
			return {
				success: false,
				reply: "You must create private reminders in private messages only!",
				cooldown: this.Cooldown / 2
			};
		}

		let reminderText = args.join(" ").replace(/\s+/g, " ").trim();

		// const timedRegex = /\b(in|on|at)\b/i;
		const timedRegex = /\b(in|at)\b/i;
		let targetReminderDate = null;
		let targetReminderDelta = "when they next type in chat";
		let delta = 0;

		const now = new sb.Date();
		if (hasChrono) {
			const chronoDefinition = context.params.at ?? context.params.on;
			const chronoData = sb.Utils.parseChrono(chronoDefinition, null, { forwardDate: true });
			if (!chronoData) {
				return {
					success: false,
					reply: "Invalid time provided!"
				};
			}

			const location = await context.user.getDataProperty("location");
			const isRelative = (Object.keys(chronoData.component.knownValues).length === 0);
			if (location && !isRelative) {
				const date = chronoData.component.date();
				const response = await sb.Utils.fetchTimeData({
					date,
					coordinates: location.coordinates,
					key: sb.Config.get("API_GOOGLE_TIMEZONE")
				});

				const timeData = response.body;
				if (timeData.status === "ZERO_RESULTS") {
					return {
						success: false,
						reply: `Could not process your timezone!`
					};
				}

				const secondsOffset = (timeData.rawOffset + timeData.dstOffset);
				chronoData.component.assign("timezoneOffset", secondsOffset / 60);
				targetReminderDate = new sb.Date(chronoData.component.date());
			}
			else {
				targetReminderDate = new sb.Date(chronoData.date);
			}

			targetReminderDate.milliseconds = now.milliseconds;
			delta = sb.Utils.round(targetReminderDate - now, -3);
		}
		else if (timedRegex.test(reminderText)) {
			reminderText = reminderText.replace(/\bhr\b/g, "hour");
			const timeData = sb.Utils.parseDuration(reminderText, { returnData: true });

			if (timeData.ranges.length > 0) {
				const continueRegex = /^((\s*and\s*)|[\s\W]+)$/;
				let continues = false;

				for (let i = 0; i < timeData.ranges.length; i++) {
					// If the preceding text doesn't contain the word "in" right before the time range, skip it.
					const precedingText = reminderText.slice(0, timeData.ranges[i].start);
					if (!continues && !/\bin\b\s*$/.test(precedingText)) {
						continue;
					}

					continues = false;
					const current = timeData.ranges[i];
					const next = timeData.ranges[i + 1];

					delta += current.time;
					targetReminderDate = targetReminderDate ?? sb.Date.now();
					targetReminderDate += current.time;

					// Parse out the text between ranges, ...
					const between = (next)
						? reminderText.slice(current.end, next.start)
						: "";

					// Remove the possible preceding "in" keyword, regardless of which range it is used in
					const keywordIndex = reminderText.slice(0, current.start).lastIndexOf("in");
					if (current.start - keywordIndex === 3) {
						reminderText = reminderText.slice(0, keywordIndex) + "\x00".repeat(3) + reminderText.slice(current.start);
					}

					// and only continue if it matches a "time word separator", such as the word "and", space, comma, ...
					if (!continueRegex.test(between)) {
						reminderText = reminderText.slice(0, current.start) + reminderText.slice(current.end);
						break;
					}
					else {
						const amount = next.start - current.start;
						reminderText = reminderText.slice(0, current.start) + "\x00".repeat(amount) + reminderText.slice(next.start);
						continues = true;
					}
				}

				reminderText = reminderText.replace(/\x00/g, "");
			}
		}

		if (targetReminderDate) {
			if (typeof targetReminderDate === "number") {
				targetReminderDate = new sb.Date(targetReminderDate);
				targetReminderDelta = sb.Utils.timeDelta(targetReminderDate);
			}
			else {
				targetReminderDelta = sb.Utils.timeDelta(targetReminderDate);
			}

			const comparison = new sb.Date(now.valueOf() + delta);
			if (delta < 0) {
				return {
					success: false,
					reply: "Past reminders are only available to people who possess a time machine!"
				};
			}
			else if (now > comparison) {
				return {
					success: false,
					reply: "Timed reminders set in the past are only available for people that posess a time machine!"
				};
			}
			else if (Math.abs(now - comparison) < 30.0e3) {
				return {
					success: false,
					reply: "You cannot set a timed reminder in less than 30 seconds!",
					cooldown: this.Cooldown / 2
				};
			}
			else if ((sb.Date.now() + delta) > this.staticData.sqlDateLimit) {
				const description = (Number.isFinite(comparison.valueOf()))
					? `the date ${comparison.format("Y-m-d")}`
					: `${sb.Utils.groupDigits(Math.trunc(delta / 31_536_000_000))} years in the future`;

				return {
					success: false,
					reply: `Your reminder was set to approximately ${description}, but the limit is 31st December 9999.`,
					cooldown: this.Cooldown / 2
				};
			}
		}
		else if (targetUser === context.user) {
			return {
				success: false,
				reply: `To remind yourself, you must use the word "in"! Such as "in 5 minutes"`,
				cooldown: 2500
			};
		}

		// If it is a timed reminder via PMs, only allow it if it a self reminder.
		// Scheduled reminders for users via PMs violate the philosophy of reminders.
		if (context.privateMessage && delta !== 0) {
			if (targetUser === context.user) {
				isPrivate = true;
			}
			else {
				return {
					success: false,
					reply: "You cannot create a private timed reminder for someone else!"
				};
			}
		}

		const message = (reminderText)
			? sb.Utils.wrapString(reminderText, this.staticData.limit)
			: "(no message)";

		const result = await sb.Reminder.create({
			Channel: context?.channel?.ID ?? null,
			Platform: context.platform.ID,
			User_From: context.user.ID,
			User_To: targetUser.ID,
			Text: message,
			Schedule: targetReminderDate ?? null,
			Created: new sb.Date(),
			Private_Message: isPrivate
		});

		if (result.success) {
			if (result.ID % 1_000_000 === 0) {
				const trollShift = (Math.random() > 0.5) ? 1 : -1;
				result.ID += trollShift;
			}

			const who = (targetUser.ID === context.user.ID) ? "you" : targetUser.Name;
			const method = (isPrivate) ? "privately " : "";

			return {
				cooldown: (context.privateMessage) ? 2500 : this.Cooldown,
				reply: `I will ${method}remind ${who} ${targetReminderDelta} (ID ${result.ID})`
			};
		}
		else {
			return {
				success: false,
				reply: this.staticData.strings[result.cause] ?? `Reminder not created - result is ${result.cause}.`
			};
		}
	}),
	Dynamic_Description: (async (prefix) => [
		"Reminds a given person.",
		"There are multiple ways to remind, either whenever they type, or a timed reminder.",
		"",

		`<code>${prefix}remind (person) hello :)</code>`,
		`<code>${prefix}notify (person) hello :)</code>`,
		"Reminds target person whenever they next type in a chat that has Supibot.",
		"There is no difference between <code>remind</code> and <code>notify</code>.",
		"",

		`<code>${prefix}remindprivate (person) hello :)</code>`,
		`<code>${prefix}remind private:true (person) hello :)</code>`,
		"Privately reminds target person (via whispers/PMs) when they next type in chat with Supibot.",
		"",

		`<code>${prefix}remind (person) hello :) in (time)</code>`,
		`<code>${prefix}remind supinic hello, how's it going? in 5 minutes</code>`,
		`<code>${prefix}remind supinic in 1 year, 3 months and 5 days hi to the future!</code>`,
		"Creates a timed remind for target person that's going to fire in whatever time you provide, in the channel you used the command in.",
		"You <b>must</b> use the keyword <code>in</code> followed by the time specification for this to work.",
		"The position of the time specification does not matter.",
		"",

		`<code>${prefix}remindme test (time)</code>`,
		`<code>${prefix}remind me check pasta in 5 minutes</code>`,
		"Creates a timed reminder for yourself, much like a regular timed reminder.",
		"",

		`<code>${prefix}remind (person) test on:8pm</code>`,
		`<code>${prefix}remindme fireworks at:"July 4th 2021, 8pm"</code>`,
		`<code>${prefix}remind (person) test on:"tomorrow 10am"</code>`,
		`<code>${prefix}remind (person) test on:"today evening"</code>`,
		"Creates a timed reminder just like normal, but using a specific date + time to time it.",
		"Will use your timezone, if you have it set up via the <code>$set location</code> command.",
		"If you don't, the command will use Supibot's timezone - CET/CEST (UTC+1/+2)",
		"There are plenty of words that you can use - like morning, evening, noon, midnight, ... and more",
		""
	])
};
