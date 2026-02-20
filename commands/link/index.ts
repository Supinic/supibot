import { declare } from "../../classes/command.js";
import type { Platform } from "../../platforms/template.js";

type Verification = {
	Platform_From: Platform["ID"];
	Platform_To: Platform["ID"];
	Specific_ID: string;
	Status: string;
};

export default declare({
	Name: "link",
	Aliases: null,
	Cooldown: 5000,
	Description: "Verifies your account linking challenge across platforms. You should only ever use this command if you are prompted to.",
	Flags: ["developer", "mention", "system"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function link (context, challengeString) {
		if (!challengeString || challengeString === "alias") {
			return {
				success: false,
				reply: `You probably meant to use the "$alias link" command!`
			};
		}
		if (!context.channel) {
			return {
				success: false,
				reply: "This command is only used for account linking, and must be used in PMs!"
			};
		}

		const challengeID = await core.Query.getRecordset<number | undefined>(rs => rs
			.select("ID")
			.from("chat_data", "User_Verification_Challenge")
			.where("User_Alias = %n", context.user.ID)
			.where("Platform_To = %n", context.platform.ID)
			.where("Challenge = %s", challengeString)
			.where("Status = %s", "Active")
			.limit(1)
			.single()
			.flat("ID")
		);

		if (typeof challengeID !== "number") {
			return {
				success: false,
				reply: `No active verification found! Double check your challenge string.`
			};
		}

		const row = await core.Query.getRow<Verification>("chat_data", "User_Verification_Challenge");
		await row.load(challengeID);

		const sourcePlatform = sb.Platform.getAsserted(row.values.Platform_From);
		const targetPlatform = sb.Platform.getAsserted(row.values.Platform_To);
		const idColumnName = (sourcePlatform.name === "twitch") ? "Twitch_ID" : "Discord_ID";

		await context.user.saveProperty(idColumnName, row.values.Specific_ID);

		row.values.Status = "Completed";
		await row.save();

		return {
			success: true,
			reply: `Verification completed! You may now use the bot on ${sourcePlatform.capital} as well as ${targetPlatform.capital}.`
		};
	}),
	Dynamic_Description: null
});
