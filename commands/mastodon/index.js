module.exports = {
	Name: "mastodon",
	Aliases: [],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the last post from a given user. Also supports custom Mastodon instances.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "instance", type: "string" },
		{ name: "random", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function mastodon (context, user) {
		if (!user) {
			return {
				success: false,
				reply: "No user provided!"
			};
		}

		const instanceRegex = /^[A-Z0-9.]+$/i;
		const instance = context.params.instance ?? "mastodon.social";
		if (!instanceRegex.test(instance)) {
			return {
				success: false,
				reply: `Invalid Mastodon instance format provided! Only use the host name - e.g. "mastodon.social".`
			};
		}

		const fixedUser = (user.startsWith("@")) ? user : `@${user}`;
		let url;
		try {
			url = new URL(`https://${instance}/${fixedUser}.rss`);
		}
		catch {
			return {
				success: false,
				reply: `Invalid instance URL provided!`
			};
		}

		const key = `${instance}-${fixedUser}`;
		let data = await this.getCacheData(key);
		if (!data) {
			const response = await sb.Got("GenericAPI", {
				url,
				responseType: "text"
			});

			if (!response.ok) {
				return {
					success: false,
					reply: `Could not find that user on target Mastodon instance!`
				};
			}

			const xml = response.body;
			const rss = await sb.Utils.parseRSS(xml);

			data = {
				username: fixedUser,
				title: rss.title,
				created: rss.lastBuildDate,
				posts: rss.items.map(i => ({
					content: sb.Utils.removeHTML(i.contentSnippet ?? i.content).replace(/\s+/, " "),
					link: i.link,
					date: i.isoDate
				}))
			};

			await this.setCacheData(key, data, {
				expiry: 3_600_000 // 1 hour
			});
		}

		if (data.posts.length === 0) {
			return {
				success: false,
				reply: `That user has not posted anything just yet!`
			};
		}

		let post;
		if (context.params.random) {
			post = sb.Utils.randArray(data.posts);
		}
		else {
			post = data.posts[0];
		}

		const delta = sb.Utils.timeDelta(new sb.Date(post.date));
		return {
			reply: `${post.content} ${post.link} (${delta})`
		};
	}),
	Dynamic_Description: async (prefix) => [
		"Fetches the last post from a provided user in a provided Mastodon instance.",
		"Uses mastodon.social by default.",
		"",

		`<code>${prefix}mastodon (user)</code>`,
		"Gets the last post of a user from mastodon.social.",
		"",

		`<code>${prefix}mastodon instance:(custom instance) (user)</code>`,
		"Gets the last post of a user from a provided Mastodon instance.",
		"",

		`<code>${prefix}mastodon random:true (user)</code>`,
		`<code>${prefix}mastodon instance:(custom instance) random:true (user)</code>`,
		"Gets a random post instead of the last one.",
	]
};
