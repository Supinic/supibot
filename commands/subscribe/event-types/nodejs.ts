import { CustomEventDefinition } from "../generic-event.js";

import cacheKeys from "../../../utils/shared-cache-keys.json" with { type: "json" };
const { LATEST_NODE_JS_VERSION } = cacheKeys;

type GithubRepoResponse = {
	ok: boolean;
	body: {
		created_at: string;
		tag_name: string;
		html_url: string;
	}[];
};

export default {
	name: "Node.js updates",
	aliases: ["node", "nodejs", "node.js"],
	notes: "Every hour, supibot checks for new versions of Node.js. If a change is detected, you will be notified in the channel you subscribed in.",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new version of Node.js is detected.",
		removed: "You will no longer receive pings when Node.js is updated."
	},
	generic: true,
	cronExpression: "0 */5 * * * *",
	subName: "Node.js version",
	type: "custom",
	process: async () => {
		const response = await sb.Got.get("GitHub")({
			url: "repos/nodejs/node/releases"
		}) as GithubRepoResponse;

		if (!response.ok) {
			return;
		}

		const data = response.body.sort((a, b) => new sb.Date(b.created_at) - new sb.Date(a.created_at));
		const latest = data[0];

		const latestCacheVersion = await sb.Cache.getByPrefix(LATEST_NODE_JS_VERSION);
		if (latest.tag_name === latestCacheVersion) {
			return;
		}

		await sb.Cache.setByPrefix(LATEST_NODE_JS_VERSION, latest.tag_name);

		const releaseDate = new sb.Date(latest.created_at).format("Y-m-d H:i");
		return {
			message: sb.Utils.tag.trim `
				New Node.js version detected! 
				PagChomp 👉 ${latest.tag_name};
				Released on ${releaseDate}; 
				Changelog: ${latest.html_url}
			`
		};
	}
} satisfies CustomEventDefinition;
