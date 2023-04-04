export const definition = {
	name: "chatter",
	aliases: [],
	description: "Selects a random chatter within the channel, and outputs their name. Not applicable in PMs. Use the \"excludeSelf:true\" parameter to exclude yourself from the random chatter roll",
	examples: [
		["$abb chatter", "(user))"], ["$abb chatter excludeSelf:true", "(someone who is not you)"]
	],
	execute: async (context) => {
		if (context.privateMessage) {
			return {
				success: false,
				reply: "There is nobody else here 😨"
			};
		}
		else if (typeof context.channel.fetchUserList !== "function") {
			return {
				success: false,
				reply: "This has not been implemented here... yet! 4Head"
			};
		}

		const onCooldown = !sb.CooldownManager.check(context.channel.ID, context.user.ID, "abb-chatter", true);
		if (onCooldown) {
			return {
				success: false,
				reply: "Currently on cooldown!"
			};
		}

		const users = await context.channel.fetchUserList();
		const botIndex = users.findIndex(i => i.toLowerCase() === context.platform.Self_Name);
		if (botIndex !== -1) {
			users.splice(botIndex, 1);
		}

		if (context.params.excludeSelf) {
			const index = users.findIndex(i => i.toLowerCase() === context.user.Name);
			if (index !== -1) {
				users.splice(index, 1);
			}
		}

		sb.CooldownManager.set(context.channel.ID, context.user.ID, "abb-chatter", 10_000);
		return {
			reply: sb.Utils.randArray(users)
		};
	}
};
