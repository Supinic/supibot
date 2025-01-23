import cacheKeys from "../utils/shared-cache-keys.json" with { type: "json" };
import LinkParser from "track-link-parser";

const { SOUNDCLOUD_CLIENT_ID } = cacheKeys;
let linkParser;

export default async () => {
	if (!linkParser) {
		const options = {};
		if (process.env.API_GOOGLE_YOUTUBE) {
			options.youtube = {
				key: process.env.API_GOOGLE_YOUTUBE
			};
		}
		else {
			console.debug("Link parser: Skipping YouTube setup (API_GOOGLE_YOUTUBE)");
		}

		const soundcloudClientId = await sb.Cache.getByPrefix(SOUNDCLOUD_CLIENT_ID) ?? process.env.SOUNDCLOUD_CLIENT_ID;
		if (soundcloudClientId) {
			options.soundcloud = {
				key: soundcloudClientId
			};
		}
		else {
			console.debug("Link parser: Skipping Soundcloud setup (SOUNDCLOUD_CLIENT_ID)");
		}

		if (process.env.BILIBILI_APP_KEY && process.env.BILIBILI_PRIVATE_TOKEN) {
			options.bilibili = {
				appKey: process.env.BILIBILI_APP_KEY,
				token: process.env.BILIBILI_PRIVATE_TOKEN
			};
		}
		else {
			console.debug("Link parser: Skipping Bilibili setup (BILIBILI_APP_KEY, BILIBILI_PRIVATE_TOKEN)");
		}

		linkParser = new LinkParser(options);
	}

	return linkParser;
};
