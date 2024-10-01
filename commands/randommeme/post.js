module.exports = class RedditPost {
	#author;
	#created;
	#id;
	#title;
	#url;
	#commentsUrl;
	#galleryLinks;

	#flairs = [];
	#crosspostOrigin = null;
	#isTextPost = false;
	#nsfw = false;
	#stickied = false;

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

		this.#flairs = data.link_flair_richtext.filter(i => i.t && i.e === "text").map(i => sb.Utils.fixHTML(i.t.trim()));
		// if (data.link_flair_text) {
		// 	this.#flairs.push(data.link_flair_text.toLowerCase().trim());
		// }

		this.#isTextPost = Boolean(data.selftext && data.selftext_html);
		this.#nsfw = Boolean(data.over_18) || crossPostNSFW;
		this.#stickied = Boolean(data.stickied);

		this.#score = data.ups ?? 0;

		this.#galleryLinks = [];
		if (data.is_gallery) {
			const meta = data.media_metadata;
			for (const item of data.gallery_data.items) {
				const mime = meta[item.media_id].m;
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
		return sb.Utils.timeDelta(this.#created);
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
};
