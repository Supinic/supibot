module.exports = {
	Name: "chan",
	Aliases: ["4chan","textchan","filechan","imagechan"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Pulls a random post from a random board, or a specified one, if you provide it.",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: [
		{ name: "textOnly", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		replacements: [
			{
				regex: /desu/ig,
				string: "tbh"
			},
			{
				regex: /baka/ig,
				string: "smh"
			},
			{
				regex: /senpai/ig,
				string: "fam"
			},
			{
				regex: /kek/ig,
				string: "cuck"
			}
		]
	})),
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

		if (context.platform.Name === "discord") {
			enabled.file.sfw = true;
			enabled.content.nsfw = true;

			if (context.channel?.NSFW) {
				enabled.file.nsfw = true;
			}
		}
		else if (context.platform.Name === "twitch" && context.channel?.Links_Allowed) {
			enabled.file.sfw = true;
		}
		else {
			enabled.content.nsfw = Boolean(context.channel?.NSFW);
			enabled.file.nsfw = Boolean(context.channel?.NSFW);
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
				.map(i => ({
					ID: i.no,
					content: sb.Utils.fixHTML(sb.Utils.removeHTML(`${i.sub ?? ""}${i.com ?? ""}`)),
					modified: new sb.Date(i.last_modified),
					created: new sb.Date(i.tim)
				}));

			await this.setCacheData(threadKey, threadList, {
				expiry: 60_000 // 10 minutes
			});
		}

		let threadID;
		if (rest.length > 0) {
			const query = rest.join(" ").toLowerCase();
			const validThreads = threadList.filter(i => !i.dead && i.content.toLowerCase().includes(query));

			const thread = sb.Utils.randArray(validThreads);
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
		const post = sb.Utils.randArray(eligiblePosts);
		const delta = sb.Utils.timeDelta(post.created);

		if (post.content) {
			post.content = post.content.replace(/>>\d+/g, "");

			for (const { regex, string } of this.staticData.replacements) {
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
					: `${post.ID} (posted ${delta}): ${post.file} ${post.content}`
			};
		}
		else if (resultType === "content") {
			return {
				reply: (context.params.textOnly)
					? `${post.content}`
					: `${post.ID} (posted ${delta}): ${post.content}`
			};
		}
	}),
	Dynamic_Description: null
};
