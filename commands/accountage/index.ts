import { SupiDate } from "supi-core";
import { declare } from "../../classes/command.js";
import { ivrUserDataSchema } from "../../utils/schemas.js";

export default declare({
	Name: "accountage",
	Aliases: ["accage"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Fetches the Twitch account age of a given account. If none is given, checks yours.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function accountAge (context, user?: string) {
		const login = sb.User.normalizeUsername(user ?? context.user.Name).toLowerCase();
		const response = await core.Got.get("IVR")({
			url: "v2/twitch/user",
			searchParams: { login }
		});

		if (response.statusCode !== 200 || response.body.length === 0) {
			return {
				reply: "That Twitch account has no data associated with them."
			};
		}

		const data = ivrUserDataSchema.parse(response.body);
		const creationDate = data[0].createdAt;
		const created = new SupiDate(creationDate);

		let anniversary = "";
		const now = new SupiDate();
		const pronoun = (login.toLowerCase() === context.user.Name) ? "Your" : "Their";
		if (now.year > created.year && now.month === created.month && now.day === created.day) {
			const who = (login === context.platform.Self_Name) ? "my" : pronoun.toLowerCase();

			anniversary = `It's ${who} ${now.year - created.year}. Twitch anniversary! FeelsBirthdayMan Clap`;
		}

		const delta = core.Utils.timeDelta(created, false, true);
		return {
			reply: `${pronoun} Twitch account was created ${delta}. ${anniversary}`
		};
	}),
	Dynamic_Description: null
});
