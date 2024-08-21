const { fetchYoutubePlaylist } = require("../../utils/command-utils.js");

const ascendancies = require("./ascendancies.json");
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

const lab = {
	date: new sb.Date(),
	slugs: {
		uber: "wfbra",
		merciless: "riikv",
		cruel: "r8aws",
		normal: "gtgax"
	},
	images: {
		normal: null,
		cruel: null,
		merciless: null,
		uber: null
	}
};

const randomDeathData = [
	{
		player: "zizaran",
		aliases: ["ziz"],
		playlists: [
			"PLbpExg9_Xax24tS9rNt8IP49VFFaDghAG"
		],
		videoCache: []
	},
	{
		player: "quin69",
		aliases: ["quin"],
		playlists: [
			"PLcKDsqoF983aHkqXwR1HmkE7F2u6MI_FQ"
		],
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
			const urlSlug = lab.slugs[type];
			if (!urlSlug) {
				return {
					reply: `Invalid labyrinth type provided! Supported types: ${Object.keys(lab.slugs).join(", ")}`
				};
			}

			// reset all image links if new day is reached
			if (lab.date.day !== new sb.Date().day) {
				for (const key of Object.keys(lab.images)) {
					lab.images[key] = null;
				}
			}

			if (!lab.images[type]) {
				const response = await sb.Got("FakeAgent", {
					url: `https://www.poelab.com/${urlSlug}`,
					responseType: "text"
				});

				if (!response.ok) {
					console.warn("poelab lookup failure", { response });
					return {
						success: false,
						reply: `Could not load labyrinth data!`
					};
				}

				const $ = sb.Utils.cheerio(response.body);
				let imageLink = $("img#notesImg")[0].attribs.src;

				if (type === "merciless" || type === "uber") {
					const [infoEl] = $("div.su-spoiler img");
					if (infoEl) {
						imageLink += ` Additional info: ${infoEl.attribs.src}`;
					}
				}

				lab.images[type] = imageLink;
			}

			return {
				reply: `Today's ${type} labyrinth map: ${lab.images[type]}`
			};
		}
	},
	{
		name: "syndicate",
		aliases: ["syn"],
		description: "Fetches a cheat sheet link about the Syndicate.",
		execute: async () => ({
			reply: "Check the cheat sheet https://poesyn.xyz/syndicate"
		})
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
			const result = [];
			const now = sb.Date.now();

			const currentLeague = leagues.find(i => i.end && new sb.Date(i.end) > now);
			if (currentLeague) {
				const endDate = new sb.Date(currentLeague.end);
				result.push(`The ${currentLeague.patch} ${currentLeague.name} league will end ${sb.Utils.timeDelta(endDate)}.`);
			}

			const nextLeague = (currentLeague)
				? leagues.find(i => !i.end && new sb.Date(i.launch) > now)
				: leagues.find(i => !i.end || new sb.Date(i.end) > now);

			if (nextLeague) {
				const { name, patch, reveal, launch } = nextLeague;
				const revealDate = new sb.Date(reveal);
				const launchDate = new sb.Date(launch);

				if (revealDate > now) {
					result.push(`The ${patch} ${name ?? ""} league will be revealed ${sb.Utils.timeDelta(revealDate)}.`);
				}
				else if (launchDate > now) {
					result.push(`The ${patch} ${name ?? ""} league will start ${sb.Utils.timeDelta(launchDate)}.`);
				}
				else {
					const possibleEnd = revealDate.clone().addMonths(4).addDays(7);
					if (possibleEnd > now) {
						const delta = sb.Utils.timeDelta(possibleEnd, true);
						result.push(`The ${patch} ${name} league has launched - go and play. It will last approximately for ${delta}.`);
					}
					else {
						result.push(`The ${patch} ${name} league has likely concluded. Ask @Supinic to add new info about the next league!`);
					}
				}
			}

			return {
				reply: result.join(" ")
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
				const { result, reason, success } = await fetchYoutubePlaylist({
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
