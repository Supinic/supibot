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
	Code: (async function mastodon (context, input) {
		if (!input) {
			return {
				success: false,
				reply: "No user provided!"
			};
		}

		let user = input;
		let instance = "mastodon.social";
		if (context.params.instance) {
			instance = context.params.instance;
		}
		else if (input) {
			const userInstanceRegex = /^@(?<username>\w+)@(?<instance>\w+)$/;
			const userLinkRegex = /^https:\/\/@(?<instance>\w+)\/@(?<username>\w+)@$/;

			const match = userInstanceRegex.match(input) ?? userLinkRegex.match(input);
			if (match) {
				instance = match.groups.instance;
				user = match.groups.user;
			}
		}

		if (!user || !instance) {
			return {
				success: false,
				reply: `Invalid user and/or instance provided! If unsure, use the @username@instance syntax.`
			};
		}

		const instanceRegex = /^[A-Z0-9.]+$/i;
		if (!instanceRegex.test(instance)) {
			return {
				success: false,
				reply: `Invalid Mastodon instance name format provided!`
			};
		}

		let nodeInfoUrl;
		try {
			nodeInfoUrl = new URL(`https://${instance}/.well-known/nodeinfo`);
		}
		catch {
			return {
				success: false,
				reply: `Invalid instance URL provided!`
			};
		}

		// Try and find nodeinfo response
		const nodeInfoResponse = await sb.Got("GenericAPI", {
			url: nodeInfoUrl
		});

		if (!nodeInfoResponse.ok) {
			return {
				success: false,
				reply: `Provided URL is not a proper Mastodon instance!`
			};
		}

		const properInstance = nodeInfoResponse.body.links[0].href;
		const node = new URL(properInstance);
		const fixedUser = (user.startsWith("@")) ? user : `@${user}`;

		let url;
		try {
			url = new URL(`https://${node.host}/${fixedUser}.rss`);
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
				responseType: "text",
				throwHttpErrors: false
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
			reply: `${post.content} ${post.link} (posted ${delta})`
		};
	}),
	Dynamic_Description: async (prefix) => [
		"Fetches the last post from a provided user in a provided Mastodon instance.",
		"Uses mastodon.social by default.",
		"",

		`<code>${prefix}mastodon (user)</code>`,
		"Gets the last post of a user from mastodon.social.",
		"",

		`<code>${prefix}mastodon @(user)@(instance)</code>`,
		`<code>${prefix}mastodon https://(instance)/@(user)</code>`,
		`<code>${prefix}mastodon instance:(custom instance) (user)</code>`,
		"",
		`<code>${prefix}mastodon @randomuser@mastodon.social</code>`,
		`<code>${prefix}mastodon https://social.fro.ge/@sunred</code>`,
		`<code>${prefix}mastodon instance:my-own-mastodon.com JustGetAHouse</code>`,
		"Gets the last post of a user from a provided Mastodon instance.",
		"",

		`<code>${prefix}mastodon random:true (user)</code>`,
		`<code>${prefix}mastodon instance:(custom instance) random:true (user)</code>`,
		"Gets a random post instead of the last one."
	]
};
