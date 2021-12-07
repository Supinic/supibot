module.exports = {
	Name: "truck",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Trucks the target user into bed. KKona",
	Flags: ["opt-out","pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function truck (context, target) {
		if (!context.channel) {
			return {
				success: false,
				reply: `You can't truck someone in private messages, there's just the two of us here!`
			};
		}

		if (target && target.startsWith("@")) {
			target = target.slice(1);
		}

		const emote = await context.channel.getBestAvailableEmote(["KKoooona", "KKonaW", "KKona"], "🤠");
		if (target?.toLowerCase() === context.platform.Self_Name) {
			return {
				reply: `${emote} I'M DRIVING THE TRUCK ${emote} GET OUT OF THE WAY ${emote}`
			};
		}
		else if (target && target.toLowerCase() !== context.user.Name) {
			return {
				reply: `You truck ${target} into bed with the power of a V8 engine ${emote} 👉🛏🚚`
			};
		}
		else {
			return {
				reply: `The truck ran you over ${emote}`
			};
		}
	}),
	Dynamic_Description: null
};
