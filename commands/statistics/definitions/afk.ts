import { SupiDate } from "supi-core";
import type { StatsSubcommandDefinition } from "../index.js";
import { afkStatuses } from "../../../classes/afk.js";

export default {
	name: "afk",
	aliases: ["total-afk", ...afkStatuses],
	title: "Away from keyboard statuses",
	description: [],
	getDescription: (prefix) => [
		`<code>${prefix}stats afk</code>`,
		`<code>${prefix}stats (other types)</code>`,
		"Checks the total time you (or another user) have been afk for.",
		`Each status type is separate, you can check any of these: ${afkStatuses.join(", ")}`,

		`<code>${prefix}stats total-afk</code>`,
		"Checks all AFK statuses together."
	],
	execute: async (context, type, user) => {
		const targetUser = (user)
			? await sb.User.get(user)
			: context.user;

		if (!targetUser) {
			return {
				success: false,
				reply: "Provided user does not exist!"
			};
		}
		else if (targetUser.Name === context.platform.Self_Name) {
			return {
				success: false,
				reply: `I'm a bot - and we don't really need to sleep, I'm always awake!`
			};
		}

		const data = await core.Query.getRecordset<{ Amount: bigint, Delta: number } | undefined>(rs => rs
			.select("COUNT(*) AS Amount")
			.select("SUM(UNIX_TIMESTAMP(Ended) - UNIX_TIMESTAMP(Started)) AS Delta")
			.from("chat_data", "AFK")
			.where("User_Alias = %n", targetUser.ID)
			.where("Interrupted_ID IS NULL")
			.where(
				{ condition: (type === "afk") },
				"Status = %s OR Status IS NULL",
				type
			)
			.where(
				{ condition: (type !== "afk" && type !== "total-afk") },
				"Status = %s",
				type
			)
			.single()
		);

		const who = (targetUser === context.user) ? "You have" : "That user has";
		const target = (type === "total-afk") ? "(all combined)" : type;
		if (!data) {
			return {
				success: true,
				reply: `${who} not been AFK with status "${target}" at all.`
			};
		}

		const interruptedAmount = await core.Query.getRecordset<number>(rs => rs
			.select("COUNT(*) AS Amount")
			.from("chat_data", "AFK")
			.where("User_Alias = %n", targetUser.ID)
			.where("Interrupted_ID IS NOT NULL")
			.where(
				{ condition: (type === "afk") },
				"Status = %s OR Status IS NULL",
				type
			)
			.where(
				{ condition: (type !== "afk" && type !== "total-afk") },
				"Status = %s",
				type
			)
			.flat("Amount")
			.single()
		);

		const delta = core.Utils.timeDelta(SupiDate.now() + data.Delta * 1000, true);
		const average = core.Utils.timeDelta(SupiDate.now() + (data.Delta * 1000 / Number(data.Amount)), true);

		return {
			success: true,
			reply: core.Utils.tag.trim `
				${who} been AFK with status "${target}"
				${Number(data.Amount)} times,
				for a total of ~${delta}.
				This averages to ~${average} spent AFK per invocation.
				${who} resumed AFK statuses ${interruptedAmount} times.
			`
		};
	}
} satisfies StatsSubcommandDefinition;
