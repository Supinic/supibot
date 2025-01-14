export const definition = {
	Name: "automatic-unscramble",
	Events: ["message"],
	Description: "Attempts to auto-unscramble thepositivebot's unscramble minigame.",
	Code: (async function automaticUnscramble (context) {
		const { channel, message, user } = context;
		if (channel.mode === "Read") {
			return;
		}
		else if (!user || user.Name !== "thepositivebot") {
			return;
		}

		const regex = /person to unscramble (\w+)/i;
		const match = message.match(regex);
		if (!match) {
			return;
		}

		const scramble = match[1];
		const query = sb.Command.get("query");
		if (!query) {
			return;
		}

		const fauxContext = sb.Command.createFakeContext(query, {
			platform: context.channel.Platform
		});

		const { reply } = await query.execute(fauxContext, `unscramble ${scramble}`);
		if (reply.includes("did not understand")) {
			console.warn("Unscramble module - could not run query", { message, reply, scramble });
			return;
		}

		const response = (reply.includes("No short answer"))
			? "That can't be unscrambled PepeLaugh Clap"
			: reply.replaceAll(`"`, "");

		await channel.send(response);
	}),
	Global: false,
	Platform: null
};
