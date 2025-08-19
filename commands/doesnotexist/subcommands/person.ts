import { SupiDate } from "supi-core";
import type { DoesNotExistSubcommandDefinition } from "../index.js";
import { uploadToImgur } from "../../../utils/command-utils.js";

type PersonDoesNotExistResponse = {
	src: string;
};

export default {
	name: "person",
	aliases: [],
	title: "Person",
	default: true,
	description: [],
	getDescription: (prefix) => [
		`<code>${prefix}</code> - <a href="https://this-person-does-not-exist.com/">This $prefix} does not exist</a>`
	],
	execute: async () => {
		const response = await core.Got.get("GenericAPI")<PersonDoesNotExistResponse>({
			url: "https://this-person-does-not-exist.com/new",
			searchParams: {
				new: SupiDate.now(),
				gender: "all", // male, female
				age: "all", // 12-18, 19-25, 26-35, 35-50, 50+
				etnic: "all" // asian, black, white, indian, middle eastern, latino hispanic
			}
		});

		if (!response.ok) {
			return {
				success: false,
				reply: `Could not generate a random picture!`
			};
		}

		const { src } = response.body;
		const imageResponse = await core.Got.get("FakeAgent")({
			url: `https://this-person-does-not-exist.com${src}`,
			responseType: "buffer"
		});

		if (!imageResponse.ok) {
			return {
				success: false,
				reply: `Could not fetch a random picture!`
			};
		}

		// rawBody might not exist? fall back to `body` just in case, honestly
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		const { statusCode, link } = await uploadToImgur(imageResponse.rawBody ?? imageResponse.body, { type: "image" });
		if (statusCode !== 200 || !link) {
			return {
				success: false,
				reply: `Could not upload the image to Imgur! Errors: ${statusCode}`
			};
		}

		return {
			text: link,
			reply: `This person does not exist: ${link}`
		};
	}
} satisfies DoesNotExistSubcommandDefinition;
