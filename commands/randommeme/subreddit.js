import { SupiDate } from "supi-core";
import RedditPost from "./post.js";

const defaultSubredditCacheExpiration = 2 * 3_600_000;

export default class Subreddit {
	#name;
	#error = null;
	// #errorMessage = null;
	#exists = false;
	#reason = null;
	#quarantine = null;
	#nsfw = null;
	#expiration = -Infinity;
	#posts = [];

	static defaultSubredditCacheExpiration = defaultSubredditCacheExpiration;

	constructor (meta) {
		// this.#errorMessage = meta.message ?? null;
		this.#error = meta.error ?? null;
		this.#reason = meta.reason ?? null;

		if (meta.data && typeof meta.data.dist === "undefined") {
			const { data } = meta;
			this.#name = data.display_name;
			this.#exists = (!data.children || data.children !== 0);
			this.#quarantine = Boolean(data.quarantine);
			this.#nsfw = Boolean(data.over18);
		}
		else {
			this.#exists = false;
			this.#expiration = Infinity;
		}
	}

	setExpiration () {
		this.#expiration = new SupiDate().addMilliseconds(Subreddit.defaultSubredditCacheExpiration);
	}

	addPosts (data) {
		this.#posts = data.map(i => new RedditPost(i.data));
	}

	get availableFlairs () {
		return new Set(this.#posts.flatMap(i => i.flairs));
	}

	get posts () { return this.#posts; }
	get expiration () { return this.#expiration; }
	get error () { return this.#error; }
	get exists () { return this.#exists; }
	get name () { return this.#name; }
	get nsfw () { return this.#nsfw; }
	get quarantine () { return this.#quarantine; }
	get reason () { return this.#reason; }
};
