module.exports = {
	Name: "remind",
	Aliases: ["notify", "reminder", "remindme", "notifyme", "remindprivate", "notifyprivate"],
	Author: "supinic",
	Last_Edit: "2020-10-03T17:34:35.000Z",
	Cooldown: 10000,
	Description: "Sets a notify for a given user. Can also set a time to ping that user (or yourself) in given amount of time, but in that case you must use the word \"in\" and then a number specifying the amount days, hours, minutes, etc.",
	Flags: ["block","mention","opt-out","pipe"],
	Whitelist_Response: null,
	Static_Data: ({
		strings: {
			"scheduled-incoming": "That person has too many timed reminders pending for them on that day!",
			"public-incoming": "That person has too many public reminders pending!",
			"public-outgoing":  "You have too many public reminders pending!",
			"private-incoming": "That person has too many private reminders pending!",
			"private-outgoing": "You have too many private reminders pending!"
		}
	}),
	Code: (async function remind (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: `Incorrect syntax! Use "remind (person) (text)"`,
				cooldown: 2500
			};
		}
	
		let targetUser = await sb.Utils.getDiscordUserDataFromMentions(args[0].toLowerCase(), context.append) || await sb.User.get(args[0], true);
		if (context.invocation.includes("me") || args[0] === "me" || (targetUser && targetUser.ID === context.user.ID)) {
			targetUser = context.user;
	
			if (!context.invocation.includes("me")) {
				args.shift();
			}
		}
		else if (!targetUser) {
			return {
				reply: "An invalid user was provided!",
				cooldown: this.Cooldown / 2
			};
		}
		else if (targetUser.Name === context.platform.Self_Name) {
			return {
				reply: "I'm always here, so you don't have to " + context.invocation + " me :)",
				cooldown: this.Cooldown / 2
			};
		}
		else {
			args.shift();
		}
	
		let isPrivate = context.invocation.includes("private");
		for (let i = 0; i < args.length; i++) {
			const token = args[i];
	
			if (token === "private:true") {
				isPrivate = true;
				args.splice(i, 1);
			}
		}
	
		if (isPrivate && context.channel !== null) {
			return {
				reply: "You should create private reminders in private messages!",
				cooldown: this.Cooldown / 2
			};
		}
	
		let reminderText = args.join(" ");
	
		// const timedRegex = /\b(in|on|at)\b/i;
		const timedRegex = /\b(in|at)\b/i;
		let targetReminderDate = null;
		let targetReminderDelta = "when they next type in chat";
		let delta = 0;
	
		const now = new sb.Date();
		if (timedRegex.test(reminderText)) {
			reminderText = reminderText.replace(/\bhr\b/g, "hour");
	
			// const chronoRegex = /\bon\b/;
			// const chronoData = sb.Utils.parseChrono(reminderText, null, { forwardDate: true });
			const timeData = sb.Utils.parseDuration(reminderText, { returnData: true });
	
	/*
			if (chronoRegex.test(chronoData?.text ?? "")) {
				const isRelative = (Object.keys(chronoData.component.knownValues).length === 0);
				if (targetUser?.Data.location && !isRelative) {
					const location = targetUser.Data.location;
					if (!location.timezone) {
						const time = sb.Command.get("time");
						await time.execute(context, "@" + targetUser.Name);
					}
	
					const { offset } = location.timezone;
					chronoData.component.assign("timezoneOffset", offset / 60);
					targetReminderDate = new sb.Date(chronoData.component.date());
				}
				else {
					targetReminderDate = new sb.Date(chronoData.date);
				}
	
				if (chronoData.text) {
					reminderText = reminderText.replace(chronoData.text, "");
				}
	
				targetReminderDate.milliseconds = now.milliseconds;
				delta = sb.Utils.round(targetReminderDate - sb.Date.now(), -3);
			}
	*/
	
			if (timeData.ranges.length > 0) {
				const continueRegex = /^(and|[\s\W]+)$/;
	
				let continues = false;
				for (let i = 0; i < timeData.ranges.length; i++) {
					// If the preceding text doesn't contain the word "in" right before the time range, skip it.
					const precedingText = reminderText.slice(0, timeData.ranges[i].start);
					if (!continues && !precedingText.match(/\bin\b\s*$/)) {
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
	
				if (timeData.ranges[0]?.start) {
					const end = timeData.ranges[0].start;
					const preceder = reminderText.slice(end - 3, end);
					if (timedRegex.test(preceder)) {
						reminderText = reminderText.slice(0, end - 3) + "\x00".repeat(3) + reminderText.slice(end);
					}
				}
	
				reminderText = reminderText.replace(/\x00/g, "");
			}
			
			if (delta > 0) {
				if (typeof targetReminderDate === "number") {
					targetReminderDate = new sb.Date(targetReminderDate);
					targetReminderDelta = sb.Utils.timeDelta(targetReminderDate);
				}
				else {
					targetReminderDelta = sb.Utils.timeDelta(sb.Date.now() + targetReminderDate.valueOf());
				}
			}
		}
	
		const comparison = new sb.Date(now.valueOf() + delta);
		if (delta < 0) {
			return {
				success: false,
				reply: "Past reminders are only available to people who possess a time machine!",
			};
		}
		else if (delta === 0) {
			if (targetUser === context.user) {
				return {
					reply: `To remind yourself, your text must have the word "in" - such as "check in 5 minutes"`,
					cooldown: 2500
				};
			}
		}
		else if (now > comparison) {
			return { reply: "Timed reminders set in the past are only available for people that posess a time machine!" };
		}
		else if (Math.abs(now - comparison) < 30.0e3) {
			return {
				reply: "You cannot set a timed reminder in less than 30 seconds!",
				cooldown: this.Cooldown / 2
			};
		}
		else if ((sb.Date.now() + delta) > sb.Config.get("SQL_DATETIME_LIMIT")) {
			const description = (Number.isFinite(comparison.valueOf()))
				? comparison.format("Y-m-d")
				: `${Math.trunc(delta / 31_536_000_000)} years in the future`;
	
			return {
				reply: `Your reminder was set to approximately ${description}, but the limit is 31st December 9999.`,
				cooldown: this.Cooldown / 2
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
					reply: "You cannot create a private timed reminder for someone else!"
				};
			}
		}
	
		const result = await sb.Reminder.create({
			Channel: context?.channel?.ID ?? null,
			Platform: context.platform.ID,
			User_From: context.user.ID,
			User_To: targetUser.ID,
			Text: reminderText || "(no message)",
			Schedule: targetReminderDate ?? null,
			Created: new sb.Date(),
			Private_Message: isPrivate
		});
		if (result.success) {
			const who = (targetUser.ID === context.user.ID) ? "you" : targetUser.Name;
			const method = (isPrivate) ? "privately " : "";
	
			return {
				reply: `I will ${method}remind ${who} ${targetReminderDelta} (ID ${result.ID})`
			};
		}
		else {
			return {
				reply: this.staticData.strings[result.cause] ?? `Reminder not created - result is ${result.cause}.`
			};
		}
	}),
	Dynamic_Description: null
};