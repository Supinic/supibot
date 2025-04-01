import LinkParser, { type KeyOptions } from "track-link-parser";
import cacheKeys from "../utils/shared-cache-keys.json" with { type: "json" };
const { SOUNDCLOUD_CLIENT_ID } = cacheKeys;

type ParserOptions = {
	youtube?: KeyOptions;
	soundcloud?: KeyOptions;
};

let linkParser: LinkParser | null = null;
export default async (): Promise<LinkParser> => {
	if (!linkParser) {
		const options: ParserOptions = {};
		if (process.env.API_GOOGLE_YOUTUBE) {
			options.youtube = {
				key: process.env.API_GOOGLE_YOUTUBE
			};
		}
		else {
			console.debug("Link parser: Skipping YouTube setup (API_GOOGLE_YOUTUBE)");
		}

		const soundcloudClientId = (await sb.Cache.getByPrefix(SOUNDCLOUD_CLIENT_ID) ?? process.env.SOUNDCLOUD_CLIENT_ID) as string | undefined;
		if (soundcloudClientId) {
			options.soundcloud = {
				key: soundcloudClientId
			};
		}
		else {
			console.debug("Link parser: Skipping Soundcloud setup (SOUNDCLOUD_CLIENT_ID)");
		}

		linkParser = new LinkParser(options);
	}

	return linkParser;
};
