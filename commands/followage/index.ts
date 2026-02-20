import { SupiDate } from "supi-core";
import { declare } from "../../classes/command.js";
import { ivrErrorSchema, ivrSubAgeSchema } from "../../utils/schemas.js";

export default declare({
	Name: "followage",
	Aliases: ["fa"],
	Cooldown: 10000,
	Description: "Fetches the followage for a given user and a channel. If no channel is provided, checks the current one. If no user is provided either, checks yourself.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function followAge (context, ...args) {
		let channel;
		let user;
		if (args.length === 0) {
			if (!context.channel) {
				return {
					success: false,
					reply: "When in PMs, you must provide full context! Use $followage (user) (channel)."
				};
			}
			else if (context.platform.name !== "twitch") {
				return {
					success: false,
					reply: `When in ${context.platform.capital}, you must provide full context! Use $followage (user) (channel).`
				};
			}

			channel = context.channel.Name;
			user = context.user.Name;
		}
		else if (args.length === 1) {
			channel = args[0];
			user = context.user.Name;
		}
		else {
			user = args[0];
			channel = args[1];
		}

		if (user === channel.toLowerCase()) {
			if (user === context.user.Name) {
				const emote = await context.getBestAvailableEmote(["PepeLaugh", "LULW", "LuL", "4Head"], "😀");
				return {
					success: false,
					reply: `Good luck following yourself! ${emote}`
				};
			}
			else {
				const emote = await context.getBestAvailableEmote(["FeelsDankMan", "FailFish"], "🙄");
				return {
					success: false,
					reply: `People can't follow themselves! ${emote}`
				};
			}
		}

		const response = await core.Got.get("IVR")({
			url: `v2/twitch/subage/${user}/${channel}`
		});

		if (!response.ok) {
			const { data } = ivrErrorSchema.safeParse(response.body);
			const { message = "(no error message)" } = data?.error ?? {};

			let resultMessage = message;
			if (message.startsWith("Channel has been banned")) {
				resultMessage = `@${channel} is currently banned`;
			}
			else if (message.startsWith("User has been banned")) {
				resultMessage = `@${user} is currently banned`;
			}

			return {
				success: false,
				reply: `Could not check for followage! Reason: ${resultMessage}`
			};
		}

		const prefix = (user.toLowerCase() === context.user.Name) ? "You" : user;
		const suffix = (channel.toLowerCase() === context.user.Name) ? "you" : channel;

		const { followedAt } = ivrSubAgeSchema.parse(response.body);
		if (!followedAt) {
			const verb = (user.toLowerCase() === context.user.Name) ? "are" : "is";
			return {
				success: true,
				reply: `${prefix} ${verb} not following ${suffix}.`
			};
		}

		const verb = (user.toLowerCase() === context.user.Name) ? "have" : "has";
		const delta = core.Utils.timeDelta(new SupiDate(followedAt), true, true);
		return {
			success: true,
			reply: `${prefix} ${verb} been following ${suffix} for ${delta}.`
		};
	}),
	Dynamic_Description: null
});
