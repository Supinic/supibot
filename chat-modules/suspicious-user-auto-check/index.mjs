export const definition = {
	Name: "suspicious-user-auto-check",
	Events: ["message"],
	Description: "For each user who types (a part of) the \"suspicious user\" message, this module will automatically try the $$suscheck alias.",
	Code: (async function suspiciousUserAutoChecker (context) {
		const { channel, message, raw, user } = context;
		if (channel.mode === "Read") {
			return;
		}
		// Immediately return if the user is **NOT** suspicious
		// If the user object is present, then immediately return - suspicious users will be seen as "raw" instead
		else if (user) {
			return;
		}

		this.data.checkedUsernames ??= new Set();

		if (!message.includes("suspicious")) {
			return;
		}

		this.data.checkedUsernames.add(raw.user);

		const assumedUserID = await sb.Query.getRecordset(rs => rs
			.select("Twitch_ID")
			.from("chat_data", "User_Alias")
			.where("Name = %s", raw.user)
			.flat("Twitch_ID")
			.single()
			.limit(1)
		);

		const response = await sb.Got("Leppunen", {
			url: "v2/twitch/user",
			searchParams: {
				id: assumedUserID
			}
		});

		if (!response.ok || response.body.length === 0) {
			await channel.send(`Could not check @${raw.user} for suspiciousness!`);
			return;
		}

		const [data] = response.body;
		if (data.login === raw.user) {
			const logID = await sb.Logger.log(
				"Twitch.Warning",
				`Weird suspicious case: ${JSON.stringify({ data, assumedUserID })}`
			);

			await channel.send(`It seems like @${raw.user} is not suspicious at all...! Something probably went wrong, check Log ID ${logID} please`);
			return;
		}

		const resultMessage = sb.Utils.tag.trim `
			Hey @${raw.user}, I'd like to verify whether @${data.login} is either: 
			another account,
			or a previous name that you have used in the past.
			Can you confirm this for me?
		`;

		await channel.send(resultMessage);
	}),
	Global: false,
	Platform: null
};
