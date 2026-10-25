import type { ApiDefinition } from "./index.ts";

export default {
	reloadAll: async () => {
		await sb.AwayFromKeyboard.reloadData();
		return {
			statusCode: 200,
			data: { message: "OK" }
		};
	},
	unsetSpecific: async (req, res, url) => {
		const ID = Number(url.searchParams.get("ID"));
		if (!Number.isSafeInteger(ID)) {
			return {
				statusCode: 400,
				error: { message: "Invalid AFK ID provided" }
			};
		}

		const row = sb.AwayFromKeyboard.get(ID);
		if (!row) {
			return {
				statusCode: 404,
				error: { message: "Provided AFK ID does not exist" }
			};
		}

		await sb.AwayFromKeyboard.unset(ID);
		return {
			statusCode: 200,
			data: { message: "OK" }
		};
	}
} satisfies ApiDefinition;
