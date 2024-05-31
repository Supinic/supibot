const FOUR_CHAN_REPLACEMENTS = [
	{ regex: /desu/ig, string: "tbh" },
	{ regex: /baka/ig, string: "smh" },
	{ regex: /senpai/ig, string: "fam" },
	{ regex: /kek/ig, string: "cuck" }
];

module.exports = {
	Name: "chan",
	Aliases: ["4chan","textchan","filechan","imagechan"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Pulls a random post from a random 4Chan board, or a specified one if you provide it.",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: [
		{ name: "regex", type: "regex" },
		{ name: "search", type: "string" },
		{ name: "textOnly", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function chan (context, identifier, ...rest) {
		if (!identifier) {
			return {
				reply: "You must specify a board name!"
			};
		}

		const enabled = {
			content: {
				sfw: true,
				nsfw: false
			},
			file: {
				sfw: false,
				nsfw: false
			}
		};

		if (context.channel?.NSFW) {
			enabled.content.nsfw = true;
			enabled.file.nsfw = true;
		}

		if (context.platform.Name === "discord") {
			enabled.file.sfw = true;
			enabled.content.nsfw = true;
		}
		else if (context.platform.Name === "twitch" && context.channel?.Links_Allowed) {
			enabled.file.sfw = true;
		}

		let resultType = (context.channel?.NSFW)
			? "file"
			: "content";

		if (context.invocation === "textchan") {
			resultType = "content";
		}
		else if (context.invocation === "imagechan" || context.invocation === "filechan") {
			if (!enabled.file.sfw && !enabled.file.nsfw) {
				return {
					reply: "You cannot query for images here!"
				};
			}

			resultType = "file";
		}

		let boardList = await this.getCacheData({ type: "board-list" });
		if (!boardList) {
			const response = await sb.Got("GenericAPI", {
				url: "https://api.4chan.org/boards.json",
				responseType: "json"
			});

			boardList = response.body.boards.map(i => ({
				name: i.board,
				title: i.title,
				nsfw: !i.ws_board
			}));

			await this.setCacheData({ type: "board-list" }, boardList, {
				expiry: 86_400_000 // 1 day
			});
		}

		if (!/^[a-z0-9]+$/.test(identifier)) {
			return {
				success: false,
				reply: "Use only lowercase characters + letters for board names! (e.g. no slashes)"
			};
		}

		const board = boardList.find(i => i.name === identifier);
		if (!board) {
			return {
				success: false,
				reply: "Couldn't match your board! Use their abbreviations only."
			};
		}
		else if (board.nsfw && !enabled[resultType].nsfw) {
			const pretty = (resultType === "content") ? "text" : "images";
			return {
				reply: `You can't check 4chan for ${pretty} in here, because the board you used is marked as NSFW!`
			};
		}

		if (board.nsfw && context.append.pipe) {
			return {
				success: false,
				reason: "pipe-nsfw"
			};
		}

		const threadKey = { type: "thread-list", board: identifier };
		let threadList = await this.getCacheData(threadKey);
		if (!threadList) {
			const response = await sb.Got("GenericAPI", {
				url: `https://api.4chan.org/${board.name}/catalog.json`,
				responseType: "json"
			});

			threadList = response.body
				.flatMap(i => i.threads)
				.filter(i => !i.sticky && !i.closed && i.replies >= 5)
				.map(i => {
					const title = sb.Utils.fixHTML(sb.Utils.removeHTML(i.sub ?? ""));
					const subtitle = sb.Utils.fixHTML(sb.Utils.removeHTML(i.com ?? ""));

					return {
						ID: i.no,
						contentSplitIndex: title.length,
						content: `${title}${subtitle}`,
						modified: new sb.Date(i.last_modified),
						created: new sb.Date(i.tim)
					};
				});

			await this.setCacheData(threadKey, threadList, {
				expiry: 60_000 // 10 minutes
			});
		}

		let threadID;
		if (rest.length > 0 || context.params.regex) {
			const query = rest.join(" ").toLowerCase();
			const filteredThreads = threadList.filter(i => {
				if (i.dead) {
					return false;
				}

				let targetString;
				if (context.params.search === "title") {
					targetString = i.content.slice(0, i.contentSplitIndex);
				}
				else if (context.params.search === "subtitle") {
					targetString = i.content.slice(i.contentSplitIndex);
				}
				else {
					targetString = i.content;
				}

				if (context.params.regex) {
					return context.params.regex.test(targetString);
				}
				else {
					return targetString.toLowerCase().includes(query);
				}
			});

			const thread = sb.Utils.randArray(filteredThreads);
			if (!thread) {
				return {
					success: false,
					reply: "No threads found for your query!"
				};
			}

			threadID = thread.ID;
		}
		else {
			const thread = sb.Utils.randArray(threadList);
			threadID = thread.ID;
		}

		const postKey = { type: "post-list", board: identifier, threadID };
		let postList = await this.getCacheData(postKey);
		if (!postList) {
			const response = await sb.Got("GenericAPI", {
				url: `https://a.4cdn.org/${board.name}/thread/${threadID}.json`,
				throwHttpErrors: false,
				responseType: "json"
			});

			if (response.statusCode === 404) {
				const index = threadList.findIndex(i => i.ID === threadID);
				if (index !== -1) {
					threadList.splice(index, 1);
					await this.setCacheData(threadKey, threadList, { keepTTL: true });
				}

				return {
					reply: "The thread you rolled has been pruned/archived! Please try again.",
					cooldown: 2500
				};
			}

			// If a post has the `replies` property, it is the first post of a thread, which should be filtered out.
			postList = response.body.posts
				.filter(i => typeof i.replies !== "number")
				.map(i => ({
					ID: i.no,
					author: i.name,
					created: new sb.Date(i.time * 1000),
					content: (i.com)
						? sb.Utils.fixHTML(sb.Utils.removeHTML(i.com ?? ""))
						: null,
					file: (typeof i.filename !== "undefined")
						? `https://i.4cdn.org/${board.name}/${i.tim}${i.ext}`
						: null
				}));

			await this.setCacheData(postKey, postList, {
				expiry: 300_000 // 5 minutes
			});
		}

		const eligiblePosts = postList.filter(i => i[resultType]);
		if (eligiblePosts.length === 0) {
			return {
				success: false,
				reply: `No valid posts found!`
			};
		}

		const post = sb.Utils.randArray(eligiblePosts);
		const delta = sb.Utils.timeDelta(new sb.Date(post.created));

		if (post.content) {
			post.content = post.content.replace(/>>\d+/g, "");

			for (const { regex, string } of FOUR_CHAN_REPLACEMENTS) {
				post.content = post.content.replace(regex, string);
			}

			if (enabled.content.nsfw === false) {
				post.content = post.content.replace(sb.Config.get("LINK_REGEX"), "[LINK]");
			}
		}

		if (resultType === "file") {
			return {
				reply: (context.params.textOnly)
					? `${post.file} ${post.content}`
					: `${post.ID} (posted ${delta}): ${post.file} ${post.content ?? ""}`
			};
		}
		else if (resultType === "content") {
			return {
				reply: (context.params.textOnly)
					? `${post.content}`
					: `${post.ID} (posted ${delta}): ${post.content ?? ""}`
			};
		}
	}),
	Dynamic_Description: (() => [
		"Query 4chan for text or image posts",
		"NSFW content is only enabled on Discord NSFW channels.",
		"",

		`<code>$4chan (board abbreviation)</code>`,
		"<code>$4chan g</code>",
		"Fetches a random post from a random thread from the specified board.",
		"You must specify the board abbreviation exactly as it is, without slashes.",
		"Stickied threads are ignored for this purpose.",
		"",

		`<code>$filechan (...)</code>`,
		`<code>$imagechan (...)</code>`,
		"As above, but only queries posts that have images or media attached to them.",
		"",

		"<code>$4chan (board) (query)</code>",
		"<code>$4chan g /mkg/</code>",
		"<code>$4chan vg old school runescape</code>",
		"Fetches a random post from a thread specified by your query, from the given board.",
		"Your query is checked against the thread's title and subtitle together.",
		"",

		"<code>$4chan (board) regex:(regex)</code>",
		"Fetches a random post from a thread specified by your regex query, from the given board.",
		"Your regex is tested against the thread's title and subtitle together.",
		"",

		"<code>$4chan (board) search:(content part)</code>",
		"<code>$4chan (board) regex:(regex) search:(content part)</code>",
		"Same as above, but your regex/query will only match the specified content part.",
		`Supports either "title" or "subtitle".`
	])
};
