import type { DoesNotExistSubcommandDefinition } from "../index.js";

export default {
	name: "fuckeduphomer",
	aliases: ["fuh"],
	title: "Automobile",
	default: false,
	description: [
		`<code>fuckeduphomer</code> - <a href="https://www.thisfuckeduphomerdoesnotexist.com/">This fucked up Homer does not exist</a>`
	],
	execute: async () => {
		const response = await core.Got.get("FakeAgent")({
			url: "https://www.thisfuckeduphomerdoesnotexist.com",
			responseType: "text"
		});

		const $ = core.Utils.cheerio(response.body);
		const text = $("#image-payload").attr("src");
		return {
			text,
			reply: `This fucked up Homer does not exist: ${text}`
		};
	}
} satisfies DoesNotExistSubcommandDefinition;
