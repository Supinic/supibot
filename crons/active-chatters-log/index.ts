import { SupiDate } from "supi-core";
import type { CronDefinition } from "../index.js";

let isTableAvailable: boolean | undefined;
export default {
	name: "active-chatters-log",
	expression: "0 */5 * * * *",
	description: "Logs the amount of currently active chatters.",
	code: async function activeChattersLog () {
		isTableAvailable ??= await core.Query.isTablePresent("data", "Active_Chatter_Log");
		if (!isTableAvailable) {
			this.stop();
			return;
		}

		const row = await core.Query.getRow("data", "Active_Chatter_Log");
		row.setValues({
			Amount: sb.User.data.size,
			Timestamp: new SupiDate().discardTimeUnits("s", "ms")
		});

		await row.save({ skipLoad: true });
	}
} satisfies CronDefinition;
