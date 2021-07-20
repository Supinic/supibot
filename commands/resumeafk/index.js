module.exports = {
	Name: "resumeafk",
	Aliases: ["rafk","cafk","continueafk"],
	Author: "supinic",
	Cooldown: 120000,
	Description: "Resumes your AFK status, if used within 5 minutes of coming back from AFK. This command can only be used once every 2 minutes (!) globally.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function resumeAFK (context) {
		if (context.privateMessage) {
			return {
				reply: "Resuming your AFK status is only permitted outside of private messages!"
			};
		}

		const lastAFK = (await sb.Query.getRecordset(rs => rs
			.select("ID", "Text", "Started", "Ended", "Status")
			.from("chat_data", "AFK")
			.where("User_Alias = %n", context.user.ID)
			.orderBy("ID DESC")
			.limit(1)
			.single()
		));

		if (!lastAFK) {
			return {
				reply: "You cannot resume your AFK status, because you have never went AFK with me before!"
			};
		}
		else if (!lastAFK.Ended) {
			return {
				reply: "You were AFK until this moment... Try again?",
				cooldown: 2500
			};
		}
		else if (lastAFK.Ended <= sb.Date.now().addMinutes(-5)) {
			return {
				reply: "You cannot resume your AFK status, because it ended more than 5 minutes ago!",
				cooldown: 2500
			};
		}

		const newAFK = await sb.AwayFromKeyboard.set(context.user, {
			User_Alias: context.user.ID,
			Text: lastAFK.Text,
			Started: lastAFK.Started,
			Active: true,
			Status: lastAFK.Status
		});

		const oldAFK = await sb.Query.getRow("chat_data", "AFK");
		await oldAFK.load(lastAFK.ID);

		oldAFK.setValues({
			Interrupted_ID: newAFK.ID,
			Active: false
		});

		await oldAFK.save();

		return {
			reply: "Your AFK status has been resumed.",
			cooldown: { // Turns the cooldown into a global one (all channels)
				user: context.user.ID,
				command: this.ID,
				channel: null,
				length: this.Cooldown
			}
		};
	}),
	Dynamic_Description: null
};
