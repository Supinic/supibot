import { searchYoutube } from "../../utils/command-utils.js";
import gameData from "./game-data.json" with { type: "json" };
const { zones } = gameData;

import config from "../../config.json" with { type: "json" };
const { listenerAddress, listenerPort } = config.local ?? {};

const EXTRA_COOLDOWN = 600_000;
const ZONE_COOLDOWN = 300_000;
const createURL = (data) => {
	const json = encodeURIComponent(JSON.stringify(data));
	return `${listenerAddress}:${listenerPort}?necrodancer=${json}`;
};

export default {
	Name: "necrodancer",
	Aliases: ["nd","ndr","necrodancerreset"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Download, beatmap and assign any (supported by youtube-dl) song link into Crypt of the Necrodancer directly. Use (link) and then (zone) - for more info, check extended help.",
	Flags: ["developer","mention","pipe","whitelist"],
	Params: [
		{ name: "zone", type: "string" }
	],
	Whitelist_Response: "Only available in supinic's channel!",
	initialize: function () {
		if (!listenerAddress || !listenerPort) {
			console.warn("$necrodancer: Listener not configured - command will be unavailable");
			this.data.ready = false;
			return;
		}

		this.data.ready = true;
		this.data.cooldowns = {};
	},
	Code: (async function necrodancer (context, ...args) {
		if (!this.data.ready) {
			return {
				success: false,
				reply: `Local playsound listener is not configured!`
			};
		}

		if (!context.channel) {
			return {
				success: false,
				reply: "This command cannot be used in PMs!"
			};
		}

		const now = sb.Date.now();
		const { invocation } = context;
		if (invocation === "ndr" || invocation === "necrodancerreset") {
			const permissions = await context.getUserPermissions();
			if (!permissions.is("administrator")) {
				return {
					success: false,
					reply: "You can't do that!"
				};
			}

			const result = await core.Got.get("GenericAPI")({
				url: createURL({
					command: "reset",
					zone: args
				}),
				throwHttpErrors: false,
				timeout: {
					request: 30_000
				},
				retry: {
					limit: 0
				}
			}).json();

			if (result.success) {
				return {
					reply: "Zone(s) reset successfully."
				};
			}
			else {
				console.warn({ result });
				return {
					success: false,
					reply: "Something went wrong trying to reset the zone(s)!"
				};
			}
		}

		const query = args.join(" ");
		let { zone } = context.params;

		if (!query) {
			return {
				reply: "Check the basic guidelines for Necrodancer songs here: https://pastebin.com/K4n151xz TL;DR - not too fast, not too slow, not too short." ,
				cooldown: 2500
			};
		}
		else if (!zone) {
			for (const zoneName of zones) {
				const cooldown = this.data.cooldowns[zoneName];

				if (!cooldown || ((cooldown + EXTRA_COOLDOWN) < now)) {
					zone = zoneName;
				}
			}

			if (!zone) {
				return {
					success: false,
					reply: `No zones are currently off cooldown! You can try and use a zone name manually instead.`,
					cooldown: 2500
				};
			}
		}

		zone = zone.toLowerCase();

		if (!zones.includes(zone)) {
			return {
				success: false,
				reply: `Invalid zone provided! Use one of: ${zones.join(", ")}`,
				cooldown: 2500
			};
		}

		let link;
		if (query.startsWith("https://")) {
			link = query;
		}
		else {
			const searchResult = await searchYoutube(query, {
				single: true,
				filterShortsHeuristic: true
			});

			link = `https://youtu.be/${searchResult.ID}`;
		}

		this.data.cooldowns[zone] = this.data.cooldowns[zone] ?? 0;

		if (this.data.cooldowns[zone] >= now) {
			const delta = core.Utils.timeDelta(this.data.cooldowns[zone]);
			return {
				reply: `The cooldown for zone ${zone} has not passed yet. Try again in ${delta}.`
			};
		}
		this.data.cooldowns[zone] = now + ZONE_COOLDOWN;
		// be sure that the HTTP request is done after the cooldown to avoid a race condition

		await context.channel.send("Download + beat mapping + saving started! Please wait...");

		let result;
		try {
			result = await core.Got.get("GenericAPI")({
				url: createURL({
					link,
					zone,
					command: "request"
				}),
				throwHttpErrors: false,
				timeout: {
					request: 30_000
				},
				retry: {
					limit: 0
				}
			}).json();
		}
		catch (e) {
			this.data.cooldowns[zone] = 0;

			if (e instanceof core.Got.TimeoutError) {
				return {
					success: false,
					reply: "Request timed out - desktop listener is probably turned off!"
				};
			}
			else {
				throw e;
			}
		}

		if (result.success) {
			const length = core.Utils.formatTime(core.Utils.round(result.length), true);
			const bpm = core.Utils.round(60 / (result.length / result.beats));
			return {
				reply: `Song added to zone ${zone}. Song length: ${length} - beats: ${result.beats} - bpm: ${bpm} AlienPls`
			};
		}
		else {
			console.warn({ result });
			this.data.cooldowns[zone] = 0;

			return {
				success: false,
				reply: "There was an error while downloading/beatmapping your link!"
			};
		}
	}),
	Dynamic_Description: ((prefix) => [
		"Downloads, beatmaps and inserts a song from a link into the Crypt of the Necrodancer game.",
		"",

		`<code>${prefix}necrodancer (link)</code>`,
		"From a given link, extracts the song, beatmaps it automatically and inserts it as the song to play ingame.",
		"If you do not pass the zone (see below), the first free game zone will be used, based on a cooldown system.",
		"",

		`<code>${prefix}necrodancer (link) <u>zone:(zone)</u></code>`,
		`<code>${prefix}necrodancer (link) <u>zone:1-1</u></code>`,
		`<code>${prefix}necrodancer (link) <u>zone:coral</u></code>`,
		"Like above, but uses a specific game zone from the list below.",
		"",

		"Zone list:",
		`<ul>${zones.map(i => `<li><code>${i}</code></li>`).join("")}</ul>`
	])
};
