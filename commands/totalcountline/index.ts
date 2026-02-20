import { declare } from "../../classes/command.js";

export default declare({
	Name: "totalcountline",
	Aliases: ["acl", "tcl"],
	Cooldown: 10000,
	Description: "Fetches the total amount of a user's (or yours, if nobody was specified) chat lines in all tracked channels summed together.",
	Flags: ["mention", "pipe", "skip-banphrase"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function totalCountLines (context, target) {
		const userData = (target) ? await sb.User.get(target) : context.user;
		if (!userData) {
			return {
				success: false,
				reply: "Provided user does not exist!",
				cooldown: 5000
			};
		}

		const lines = await core.Query.getRecordset<number | undefined>(rs => rs
			.select("SUM(Message_Count) AS Total")
			.from("chat_data", "Message_Meta_User_Alias")
			.where("User_Alias = %n", userData.ID)
			.single()
			.flat("Total")
		);

		if (!lines) {
			return {
				success: true,
				reply: "That user have not said any lines in the channels I'm in."
			};
		}

		const who = (context.user.ID === userData.ID) ? "You have" : "That user has";
		return {
			reply: `${who} sent ${core.Utils.groupDigits(lines)} chat lines across all tracked channels so far.`
		};
	}),
	Dynamic_Description: null
});
