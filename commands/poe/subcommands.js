import { fetchYoutubePlaylist } from "../../utils/command-utils.js";

import ascendancies from "./ascendancies.json" with { type: "json" };
import leagues from "./leagues.json" with { type: "json" };
import gems from "./gems.json" with { type: "json" };
const additionalGems = gems.filter(i => i.type === "additional");
const skillGems = gems.filter(i => i.type === "main");

const POE2_RELEASE_DATE = "2024-12-06 20:00";

const trials = {
	normal: "A1: Lower Prison; A2: Crypt lvl 1, Chamber of Sins lvl 2; A3: Crematorium, Catacombs, Imperial Gardens",
	cruel: "A6: Prison; A7: Crypt; A7: Chamber of Sins lvl 2",
	merciless: "A8: Bath House; A9: Tunnel; A10: Ossuary"
};
trials.all = Object.values(trials).join(" -- ");

const lab = {
	date: null,
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

export default [
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

			lab.date ??= new sb.Date();

			// reset all image links if new day is reached
			if (lab.date.day !== new sb.Date().day) {
				for (const key of Object.keys(lab.images)) {
					lab.images[key] = null;
				}
			}

			if (!lab.images[type]) {
				const response = await core.Got.get("FakeAgent")({
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

				const $ = core.Utils.cheerio(response.body);
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
			const additional = core.Utils.randArray(additionalGems);
			const skill = core.Utils.randArray(skillGems);
			const ascendancy = core.Utils.randArray(ascendancies);

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
		description: "Posts data about the upcoming or current league. Also, supports (preliminary only!) info about Path of Exile 2 - use <code>$poe2</code>",
		execute: async (context) => {
			if (context.invocation === "poe2") {
				const releaseDate = new sb.Date(POE2_RELEASE_DATE);
				const now = new sb.Date();
				const delta = core.Utils.timeDelta(releaseDate);
				const verb = (now >= releaseDate) ? "released" : "releases";

				return {
					success: true,
					reply: `Path of Exile 2 Early Access ${verb} ${delta}.`
				};
			}

			const result = [];
			const now = sb.Date.now();

			const currentLeague = leagues.find(i => i.end && new sb.Date(i.end) > now);
			if (currentLeague) {
				const endDate = new sb.Date(currentLeague.end);
				result.push(`The ${currentLeague.patch} ${currentLeague.name} league will end ${core.Utils.timeDelta(endDate)}.`);
			}

			const nextLeague = (currentLeague)
				? leagues.find(i => !i.end && new sb.Date(i.launch) > now)
				: leagues.find(i => !i.end || new sb.Date(i.end) > now);

			if (nextLeague) {
				const { name, patch, reveal, launch } = nextLeague;
				const revealDate = new sb.Date(reveal);
				const launchDate = new sb.Date(launch);

				if (revealDate > now) {
					result.push(`The ${patch} ${name ?? ""} league will be revealed ${core.Utils.timeDelta(revealDate)}.`);
				}
				else if (launchDate > now) {
					result.push(`The ${patch} ${name ?? ""} league will start ${core.Utils.timeDelta(launchDate)}.`);
				}
				else {
					const possibleEnd = revealDate.clone().addMonths(4).addDays(7);
					if (possibleEnd > now) {
						const delta = core.Utils.timeDelta(possibleEnd, true);
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
				const playlist = core.Utils.randArray(deathData.playlists);
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

			const video = core.Utils.randArray(deathData.videoCache);
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
