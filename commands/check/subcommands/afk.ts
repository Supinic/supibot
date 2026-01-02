import type { CheckSubcommandDefinition } from "../index.js";
import type { AwayFromKeyboard } from "../../../classes/afk.js";

type AfkData = Pick<AwayFromKeyboard, "Text" | "Started" | "Silent" | "Status">;

export default {
	name: "afk",
	title: "AFK status",
	aliases: [],
	description: [],
	getDescription: (prefix) => [
		`<code>${prefix}check afk (username)</code>`,
		`Checks if the specified user is currently AFK.`,
		"",

		`<code>${prefix}check ambassadors (your own username)</code>`,
		`Checks if you're AFK - only usable within private messages, because otherwise you certainly wouldn't be AFK anymore.`
	],
	execute: async (context, identifier) => {
		if (!identifier) {
			return {
				success: false,
				reply: `No username provided!`
			};
		}

		const targetUser = await sb.User.get(identifier, true);
		if (!targetUser) {
			return {
				reply: "That user was not found!"
			};
		}
		else if (targetUser.Name === context.platform.selfName) {
			return {
				reply: "MrDestructoid I'm never AFK MrDestructoid I'm always watching MrDestructoid"
			};
		}
		if (targetUser === context.user && !context.privateMessage) {
			return {
				reply: "Using my advanced quantum processing, I have concluded that you are actually not AFK!"
			};
		}

		const afkData = await core.Query.getRecordset<AfkData | undefined>(rs => rs
			.select("Text", "Started", "Silent", "Status")
			.from("chat_data", "AFK")
			.where("User_Alias = %n", targetUser.ID)
			.where("Active = %b", true)
			.single()
		);

		const pronoun = (context.user === targetUser) ? "You are" : "That user is";
		if (!afkData) {
			return {
				reply: `${pronoun} not currently AFK.`
			};
		}
		else {
			const type = (afkData.Status === "afk") ? "" : ` (${afkData.Status})`;
			const delta = core.Utils.timeDelta(afkData.Started);
			return {
				reply: `${pronoun} currently AFK${type}: ${afkData.Text || "(no message)"} (since ${delta})`
			};
		}
	}
} satisfies CheckSubcommandDefinition;
