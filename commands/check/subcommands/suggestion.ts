import { type SupiDate, SupiError } from "supi-core";
import type { CheckSubcommandDefinition } from "../index.js";
import type { User } from "../../../classes/user.js";

type SuggestionData = {
	ID: number;
	Date: SupiDate;
	Last_Update: SupiDate | null;
	Status: string | null;
	Text: string;
	User_Alias: User["ID"]
};

export default {
	name: "suggest",
	aliases: ["suggestion", "suggestions"],
	title: "Details and info about suggestions",
	description: ["Checks the status and info of a suggestion that you made. You can use \"last\" instead of an ID to check the last one you made."],
	execute: async (context, rawIdentifier) => {
		let identifier: number | string | undefined = rawIdentifier;
		if (!identifier) {
			return {
				reply: core.Utils.tag.trim `
					All suggestions: https://supinic.com/data/suggestion/list
					Your active suggestions: https://supinic.com/data/suggestion/list/active?columnAuthor=${context.user.Name}
					Your previous suggestions: https://supinic.com/data/suggestion/list/resolved?columnAuthor=${context.user.Name}
				`
			};
		}

		if (identifier === "last") {
			identifier = await core.Query.getRecordset<number | undefined>(rs => rs
				.select("ID")
				.from("data", "Suggestion")
				.where("User_Alias = %n", context.user.ID)
				.orderBy("ID DESC")
				.limit(1)
				.single()
				.flat("ID")
			);

			if (!identifier) {
				return {
					success: false,
					reply: `You have never made a suggestion, so you can't check for your last one!`
				};
			}
		}

		const inputID = Number(identifier);
		if (!core.Utils.isValidInteger(inputID, 0)) {
			return {
				success: false,
				reply: `Malformed suggestion ID provided - must be a positive integer!`
			};
		}

		const row = await core.Query.getRow<SuggestionData>("data", "Suggestion");
		await row.load(inputID, true);
		if (!row.loaded) {
			return {
				success: false,
				reply: "No such suggestion exists!"
			};
		}

		const {
			ID,
			Date: date,
			Last_Update: update,
			Status: status,
			Text: text,
			User_Alias: user
		} = row.values;

		if (status === "Quarantined") {
			return {
				success: true,
				reply: "This suggestion has been quarantined."
			};
		}

		const updated = (update)
			? `, last updated ${core.Utils.timeDelta(update)}`
			: "";

		const userData = await sb.User.get(user, true);
		if (!userData) {
			throw new SupiError({
			    message: "Assert error: Suggestion author does not exist",
				args: { user }
			});
		}

		return {
			success: true,
			reply: core.Utils.tag.trim `
				Suggestion ID ${ID}
				from ${userData.Name}:
				status ${status ?? "Pending review"}
				(posted ${core.Utils.timeDelta(date)}${updated}):
				${text}
				Detail: https://supinic.com/data/suggestion/${ID}
			`
		};
	}
} satisfies CheckSubcommandDefinition;
