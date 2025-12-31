import { CheckSubcommandDefinition } from "../index.js";

export default {
	name: "changelog",
	title: "Supibot changelog",
	aliases: [],
	description: ["Posts a link to the Supibot changelog on Discord/website; or posts details about a single change, based on its ID."],
	execute: async (context, identifier) => {
		if (!identifier) {
			return {
				success: true,
				reply: `Changelog: https://supinic.com/data/changelog/list Discord: https://discord.com/channels/633342787869212683/748955843415900280/`
			};
		}

		const ID = Number(identifier);
		if (!core.Utils.isValidInteger(ID)) {
			return {
				success: false,
				reply: `Invalid changelog ID provided!`
			};
		}

		const row = await core.Query.getRow<{ Title: string | null; }>("data", "Changelog");
		await row.load(ID, true);
		if (!row.loaded) {
			return {
				success: false,
				reply: `No changelog with this ID exists!`
			};
		}

		return {
			success: true,
			reply: `Changelog ID ${ID}: ${row.values.Title ?? "(no title)"} Read more here: https://supinic.com/data/changelog/detail/${ID}`
		};
	}
} satisfies CheckSubcommandDefinition;
