const ascendancies = require("./ascendancies.json");
const syndicate = require("./syndicate.json");
const leagues = require("./leagues.json");
const gems = require("./gems.json");
const additionalGems = gems.filter(i => i.type === "additional");
const skillGems = gems.filter(i => i.type === "main");

const trials = {
	normal: "A1: Lower Prison; A2: Crypt lvl 1, Chamber of Sins lvl 2; A3: Crematorium, Catacombs, Imperial Gardens",
	cruel: "A6: Prison; A7: Crypt; A7: Chamber of Sins lvl 2",
	merciless: "A8: Bath House; A9: Tunnel; A10: Ossuary"
};
trials.all = Object.values(trials).join(" -- ");

const labyrinthTypes = ["uber", "merciless", "cruel", "normal"];
const labyrinthData = {
	date: null,
	normal: null,
	cruel: null,
	merciless: null,
	uber: null
};

const randomDeathData = [
	{
		player: "zizaran",
		aliases: ["ziz"],
		playlists: [
			"PLbpExg9_Xax24tS9rNt8IP49VFFaDghAG"
		],
		/** @type {PlaylistVideo[]} */
		videoCache: []
	},
	{
		player: "quin69",
		aliases: ["quin"],
		playlists: [
			"PLcKDsqoF983aHkqXwR1HmkE7F2u6MI_FQ"
		],
		/** @type {PlaylistVideo[]} */
		videoCache: []
	}
];

const subcommands = [
	{
		name: "labyrinth",
		aliases: ["lab"],
		description: "Fetches the current overview picture of today's Labyrinth. Use a difficulty (normal, cruel, merciless, uber) to see each one separately.",
		execute: async (context, ...args) => {
			const type = (args[0] || "").toLowerCase();
			if (!labyrinthTypes.includes(type)) {
				return {
					reply: `Invalid labyrinth type provided! Supported types: ${labyrinthTypes.join(", ")}`
				};
			}

			if (!labyrinthData.date || labyrinthData.date.day !== new sb.Date().day) {
				labyrinthData.date = new sb.Date().setTimezoneOffset(0);
				const { statusCode, statusMessage, body: html } = await sb.Got("FakeAgent", {
					url: "https://poelab.com",
					responseType: "text"
				});

				if (statusCode === 503) {
					return {
						success: false,
						reply: `Poelab website returned error ${statusCode} - ${statusMessage}! Can't access labyrinth images.`
					};
				}

				const $ = sb.Utils.cheerio(html);
				const links = Array.from($(".redLink").slice(0, 4).map((_, i) => i.attribs.href));

				for (let i = 0; i < links.length; i++) {
					const type = labyrinthTypes[i];
					labyrinthData[type] = {
						type,
						link: links[i],
						imageLink: null
					};
				}
			}

			const detail = labyrinthData[type];
			if (detail.imageLink === null) {
				const html = await sb.Got("FakeAgent", {
					url: detail.link,
					responseType: "text"
				}).text();

				const $ = sb.Utils.cheerio(html);
				detail.imageLink = $("#notesImg")[0].attribs.src;
			}

			return {
				reply: `Today's ${type} labyrinth map: ${detail.imageLink}`
			};
		}
	},
	{
		name: "syndicate",
		aliases: ["syn"],
		description: "Fetches info about the Syndicate. If nothing is specified, you get a chart. You can also specify a Syndicate member to get their overview, or add a position to be even more specific.",
		execute: async (context, ...args) => {
			const [person, type] = args;
			if (!person) {
				return {
					reply: "Check the Syndicate sheet here (⚠HTTP only!⚠): http://poesyn.xyz/syndicate or the picture here: https://i.nuuls.com/huXFC.png"
				};
			}

			const data = syndicate.find(i => i.name === person);
			if (!data) {
				return {
					success: false,
					reply: "Syndicate member or type does not exist!"
				};
			}

			return {
				reply: (type)
					? `${data.Name} at ${type}: ${data[sb.Utils.capitalize(type)]}`
					: Object.entries(data).map(([key, value]) => `${key}: ${value}`).join("; ")
			};
		}
	},
	{
		name: "trial",
		aliases: ["trials"],
		description: "Fetches info about the Labyrinth trials for specified difficulty, or overall if not specified.",
		execute: async (context, ...args) => {
			const trialType = args.shift() ?? "all";
			return {
				reply: trials[trialType] ?? "Invalid trial type provided!"
			};
		}
	},
	{
		name: "uniques",
		aliases: [],
		description: "If a user has requested to have their unique stash tab available on supibot, you can get its link by invoking this sub-command.",
		execute: async (context, ...args) => {
			let [user] = args;
			if (!user) {
				if (!context.channel) {
					return {
						success: false,
						reply: "Must provide a user name - no channel is available!"
					};
				}

				user = context.channel.Name;
			}

			const userData = await sb.User.get(user);
			if (!userData) {
				return {
					success: false,
					reply: "Provided user does not exist!"
				};
			}

			const poeData = await userData.getDataProperty("pathOfExile");
			const link = poeData?.uniqueTabs ?? null;
			if (!link) {
				return {
					success: false,
					reply: `Provided user has no unique stash tabs set up!`
				};
			}

			return {
				reply: `${userData.Name}'s unique tab(s): ${link}`
			};
		}
	},
	{
		name: "roll",
		aliases: ["randombuild", "rb"],
		description: "Generates a build by taking a random skill gem and a random ascendancy and putting them together.",
		execute: async () => {
			const additional = sb.Utils.randArray(additionalGems);
			const skill = sb.Utils.randArray(skillGems);
			const ascendancy = sb.Utils.randArray(ascendancies);

			return {
				reply: `${skill.name} + ${additional.name} ${ascendancy}`
			};
		}
	},
	{
		name: "heist",
		aliases: [],
		description: "Posts a cheatsheet picture with a neat summary of Heist jobs + rewards.",
		execute: async () => ({
			reply: `Heist cheatsheet: https://i.imgur.com/iN05OsU.png`
		})
	},
	{
		name: "league",
		aliases: [],
		description: "Posts data about the upcoming or current league.",
		execute: async () => {
			const now = sb.Date.now();
			const [nextLeague] = leagues.sort((a, b) => new sb.Date(b) - new sb.Date(a));

			const { name, patch, reveal, launch } = nextLeague;
			const revealDate = new sb.Date(reveal);
			const launchDate = new sb.Date(launch);

			if (revealDate > now) {
				return {
					reply: `The ${patch} ${name} league will be revealed ${sb.Utils.timeDelta(revealDate)}.`
				};
			}
			else if (launchDate > now) {
				return {
					reply: `The ${patch} ${name} league will start ${sb.Utils.timeDelta(launchDate)}.`
				};
			}

			const possibleEnd = revealDate.clone().addMonths(3);
			if (possibleEnd > now) {
				const delta = sb.Utils.timeDelta(possibleEnd, true);
				return {
					reply: `The ${patch} ${name} league has launched - go and play. It will last approximately for ${delta}.`
				};
			}

			return {
				reply: `The ${patch} ${name} league has likely concluded. Ask @Supinic to add new info about the next league!`
			};
		}
	},
	{
		name: "randomdeath",
		aliases: ["rd"],
		description: "Links a random YouTube video or clip regarding a streamer's death.",
		execute: async (context, player) => {
			player = (player ?? "zizaran").toLowerCase();

			const deathData = randomDeathData.find(i => i.player === player || i.aliases.includes(player));
			if (!deathData) {
				return {
					success: false,
					reply: `There are no random death clips for that player!`
				};
			}

			if (deathData.videoCache.length === 0) {
				const playlist = sb.Utils.randArray(deathData.playlists);
				const { result, reason, success } = await sb.Utils.fetchYoutubePlaylist({
					key: sb.Config.get("API_GOOGLE_YOUTUBE"),
					playlistID: playlist
				});

				if (!success) {
					return {
						success,
						reply: `Playlist could not be fetched! Reason: ${reason}`
					};
				}
				else {
					deathData.videoCache = result;
				}
			}

			/** @type {PlaylistVideo} */
			const video = sb.Utils.randArray(deathData.videoCache);
			const emote = await context.getBestAvailableEmote(
				["PepeLaugh", "pepeLaugh", "LULW", "LULE", "LuL"],
				"😂"
			);

			return {
				reply: `${emote} 👉 https://youtu.be/${video.ID}`
			};
		}
	}
];

module.exports = {
	subcommands
};
