import type { DoesNotExistSubcommandDefinition } from "../index.js";
import { uploadToImgur } from "../../../utils/command-utils.js";

export default {
	name: "automobile",
	aliases: ["auto"],
	title: "Automobile",
	default: false,
	description: [
		`<code>automobile</code> - <a href="https://thisautomobiledoesnotexist.com/">This automobile does not exist</a>`
	],
	execute: async () => {
		const response = await core.Got.get("FakeAgent")({
			url: "https://www.thisautomobiledoesnotexist.com",
			responseType: "text"
		});

		const $ = core.Utils.cheerio(response.body);
		const imageSource = $("#vehicle").attr("src");
		if (!imageSource) {
			return {
				success: false,
				reply: "No image found!"
			};
		}

		const cleanSource = imageSource.replace("data:image/png;base64,", "");
		const imageBuffer = Buffer.from(cleanSource, "base64");

		const { statusCode, link } = await uploadToImgur(imageBuffer);
		if (statusCode !== 200 || !link) {
			return {
				success: false,
				reply: `Couldn't upload the picture to Imgur!`
			};
		}

		return {
			text: link,
			reply: `This automobile does not exist: ${link}`
		};
	}
} satisfies DoesNotExistSubcommandDefinition;
