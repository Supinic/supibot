const LinkParser = require("track-link-parser");
let linkParser;

const getLinkParser = () => {
	if (!linkParser) {
		const options = {};
		if (sb.Config.has("API_GOOGLE_YOUTUBE", false)) {
			options.youtube = {
				key: sb.Config.get("API_GOOGLE_YOUTUBE")
			};
		}
		if (sb.Config.has("SOUNDCLOUD_CLIENT_ID", false)) {
			options.soundcloud = {
				key: sb.Config.get("SOUNDCLOUD_CLIENT_ID")
			};
		}
		if (sb.Config.has("BILIBILI_APP_KEY", false) && sb.Config.has("BILIBILI_PRIVATE_TOKEN", false)) {
			options.bilibili = {
				appKey: sb.Config.get("BILIBILI_APP_KEY"),
				token: sb.Config.get("BILIBILI_PRIVATE_TOKEN")
			};
		}

		linkParser = new LinkParser(options);
	}

	return linkParser;
};

module.exports = {
	getLinkParser
};
