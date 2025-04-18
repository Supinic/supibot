export default class RedditPost {
	#author;
	#created;
	#id;
	#title;
	#url;
	#commentsUrl;
	#galleryLinks;

	#flairs = [];
	#crosspostOrigin = null;
	#nsfw = false;
	#stickied = false;
	#isTextPost = false;
	#isGallery = false;
	#isVideo = false;

	#score = 0;

	constructor (data) {
		this.#title = data.title;

		let crossPostNSFW = false;
		if (data.crosspost_parent_list && data.crosspost_parent_list.length > 0) {
			crossPostNSFW = crossPostNSFW || data.over_18;
			data = data.crosspost_parent_list.pop();
			this.#crosspostOrigin = data.subreddit_name_prefixed;
		}

		this.#author = data.author;
		this.#created = new sb.Date(data.created_utc * 1000);
		this.#id = data.id;
		this.#url = data.url;
		this.#commentsUrl = `r/${data.subreddit}/comments/${data.id}`;

		this.#flairs = data.link_flair_richtext.filter(i => i.t && i.e === "text").map(i => core.Utils.fixHTML(i.t.trim()));
		// if (data.link_flair_text) {
		// 	this.#flairs.push(data.link_flair_text.toLowerCase().trim());
		// }

		this.#isTextPost = Boolean(data.selftext && data.selftext_html);
		this.#isVideo = Boolean(data.is_video);
		this.#isGallery = Boolean(data.is_gallery);
		this.#nsfw = Boolean(data.over_18) || crossPostNSFW;
		this.#stickied = Boolean(data.stickied);

		this.#score = data.ups ?? 0;

		this.#galleryLinks = [];
		if (data.is_gallery && data.gallery_data) {
			const meta = data.media_metadata;
			for (const item of data.gallery_data.items) {
				const itemMeta = meta[item.media_id];
				if (itemMeta.status === "failed" || !itemMeta.m) {
					continue;
				}

				const mime = itemMeta.m;
				const ext = mime.split("/")[1];
				const link = `https://i.redd.it/${item.media_id}.${ext}`;

				this.#galleryLinks.push(link);
			}
		}
	}

	get id () { return this.#id; }
	get nsfw () { return this.#nsfw; }
	get stickied () { return this.#stickied; }
	get isTextPost () { return this.#isTextPost; }
	get isVideoPost () { return this.#url.includes("v.reddit"); }
	get url () { return this.#url; }
	get commentsUrl () { return this.#commentsUrl; }
	get flairs () { return this.#flairs; }

	get posted () {
		return core.Utils.timeDelta(this.#created);
	}

	hasFlair (input, caseSensitive = false) {
		if (!caseSensitive) {
			input = input.toLowerCase();
		}

		return this.#flairs.some(flair => {
			if (!caseSensitive) {
				return (flair.toLowerCase().includes(input));
			}
			else {
				return (flair.includes(input));
			}
		});
	}

	hasGallery () {
		return this.#url.includes("gallery");
	}

	hasVideo () {
		return this.#url.includes("v.reddit") || this.#url.includes("youtu");
	}

	hasGalleryLinks () {
		return (this.#galleryLinks.length > 0);
	}

	getGalleryLinks () {
		return this.#galleryLinks;
	}

	toString () {
		let fixedUrl = `https://redd.it/${this.#id}`;
		if (this.hasGallery() || this.hasVideo()) {
			fixedUrl += ` ${this.#url}`;
		}

		const xpost = (this.#crosspostOrigin)
			? `, x-posted from ${this.#crosspostOrigin}`
			: "";

		return `${this.#title} ${fixedUrl} (Score: ${this.#score}, posted ${this.posted}${xpost})`;
	}

	toJSON () {
		return {
			id: this.#id,
			url: this.#url,
			created: new Date(this.#created),
			author: this.#author,
			nsfw: this.#nsfw,
			stickied: this.#stickied,
			isTextPost: this.#isTextPost,
			isVideo: this.#isVideo,
			isGallery: this.#isGallery,
			score: this.#score,
			commentsUrl: this.#commentsUrl,
			flairs: [...this.#flairs],
			galleryLinks: [...this.#galleryLinks],
			title: this.#title,
			crosspostOrigin: this.#crosspostOrigin
		};
	}
};
