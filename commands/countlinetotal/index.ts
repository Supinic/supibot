import { SupiDate } from "supi-core";
import { declare } from "../../classes/command.js";

type HistoricLines = {
	timestamp: number;
	amount: number;
};

const cacheKey = "count-line-total-previous";
const baseCooldown = 120_000;

export default declare({
	Name: "countlinetotal",
	Aliases: ["clt"],
	Cooldown: baseCooldown,
	Description: "Fetches the number of data lines from ALL the log tables Supibot uses, including the total size and a prediction of when the storage will run out.",
	Flags: ["mention"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function countLineTotal () {
		const chatLineAmount = await core.Query.getRecordset<number | undefined>(rs => rs
			.select("SUM(AUTO_INCREMENT) AS Chat_Lines")
			.from("INFORMATION_SCHEMA", "TABLES")
			.where("TABLE_SCHEMA = %s", "chat_line")
			.flat("Chat_Lines")
			.single()
		);

		if (!chatLineAmount) {
			return {
			    success: false,
			    reply: "No chat lines are currently being logged!"
			};
		}

		let historyText = "";
		const history = await core.Cache.getByPrefix(cacheKey) as HistoricLines | undefined;
		if (history) {
			const days = (SupiDate.now() - history.timestamp) / 864e5;
			const linesPerHour = core.Utils.round((chatLineAmount - history.amount) / (days * 24), 0);

			historyText = `Lines are being added at a rate of ${core.Utils.groupDigits(linesPerHour)} lines/hr.`;
		}
		else {
			const value = {
				timestamp: SupiDate.now(),
				amount: chatLineAmount
			};

			await core.Cache.setByPrefix(cacheKey, value, {
				expiry: 365 * 864e5 // 1 year (365 days)
			});
		}

		return {
			reply: core.Utils.tag.trim `
				Currently logging ${core.Utils.groupDigits(chatLineAmount)} lines in total across all channels.
				${historyText}
			`
		};
	}),
	Dynamic_Description: null
});
