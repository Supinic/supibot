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
	
		if (!this.data.boards) {
			const data = await sb.Got("https://api.4chan.org/boards.json").json();
			this.data.boards = data.boards.map(i => ({
				name: i.board,
				title: i.title,
				nsfw: !i.ws_board,
				threads: [],
				threadsExpiration: 0
			}));
		}

		if (!/^[a-z0-9]+$/.test(identifier)) {
			return {
				success: false,
				reply: "Use only lowercase characters + letters for board names! (e.g. no slashes)"
			};
		}

		const board = this.data.boards.find(i => i.name === identifier);
		if (!board) {
			return {
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
	
		const now = sb.Date.now();
		if (board.threads.length === 0 || board.threadsExpiration < now) {
			const data = await sb.Got(`https://api.4chan.org/${board.name}/catalog.json`).json();
			board.threads = data
				.map(i => i.threads)
				.flat()
				.filter(i => !i.sticky && !i.closed && i.replies >= 5)
				.map(i => ({
					ID: i.no,
					content: sb.Utils.fixHTML(sb.Utils.removeHTML(`${i.sub ?? ""}${i.com ?? ""}`)),
					modified: new sb.Date(i.last_modified),
					created: new sb.Date(i.tim),
					posts: [],
					postsExpiration: 0
				}));
	
			board.threadsExpiration = new sb.Date().addHours(1).valueOf();
		}
	
		let thread;
		if (rest.length > 0) {
			const query = rest.join(" ").toLowerCase();
			thread = sb.Utils.randArray(board.threads.filter(i => !i.dead && i.content.toLowerCase().includes(query)));
	
			if (!thread) {
				return {
					reply: "No threads found for your query!"
				};
			}
		}
		else {
			thread = sb.Utils.randArray(board.threads.filter(i => !i.dead));
		}
	
		if (thread.posts.length === 0 || thread.postsExpiration < now) {
			const { body: data, statusCode } = await sb.Got({
				url: `https://a.4cdn.org/${board.name}/thread/${thread.ID}.json`,
				throwHttpErrors: false,
				responseType: "json"
			});
	
			if (statusCode === 404) {
				thread.dead = true;
	
				return {
					reply: "The thread has been pruned/archived! Please try again.",
					cooldown: 5000
				};
			}
	
			thread.posts = data.posts.map(i => ({
				ID: i.no,
				author: i.name,
				content: sb.Utils.fixHTML(sb.Utils.removeHTML(i.com ?? "")),
				created: new sb.Date(i.time * 1000),
				file: (typeof i.filename !== "undefined")
					? `https://i.4cdn.org/${board.name}/${i.tim}${i.ext}`
					: null
			}));
	
			thread.postsExpiration = new sb.Date().addMinutes(10).valueOf();
		}
	
		const eligiblePosts = thread.posts.filter(i => i[resultType]);
		const post = sb.Utils.randArray(eligiblePosts);
		const delta = sb.Utils.timeDelta(post.created);
	
		post.content = post.content.replace(/>>\d+/g, "");
	
		for (const { regex, string } of this.staticData.replacements) {
			post.content = post.content.replace(regex, string);
		}
	
		if (enabled.content.nsfw === false) {
			post.content = post.content.replace(sb.Config.get("LINK_REGEX"), "[LINK]");
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
