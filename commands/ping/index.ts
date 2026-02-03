import { exec } from "node:child_process";
import { promisify } from "node:util";
import { platform } from "node:os";
import { SupiDate } from "supi-core";

import { randomInt } from "../../utils/command-utils.js";
import { declare } from "../../classes/command.js";
import type { TwitchPlatform } from "../../platforms/twitch.js";

const shell = promisify(exec);
const checkLatency = async (callback: () => Promise<unknown>) => {
	try {
		const start = process.hrtime.bigint();
		await callback();

		return core.Utils.round(Number(process.hrtime.bigint() - start) / 1_000_000, 3);
	}
	catch {
		return null;
	}
};
const getTemperature = async (): Promise<string> => {
	if (platform() !== "linux") {
		return "N/A";
	}

	const [temperatureResult] = await Promise.allSettled([shell("vcgencmd measure_temp")]);
	let temperature = "N/A";
	if ("value" in temperatureResult) {
		const match = temperatureResult.value.stdout.match(/([\d.]+)/);
		if (match) {
			temperature = `${match[1]}°C`;
		}
	}

	return temperature;
};

const switchCharactersMap = {
	pang: "Peng!",
	peng: "Ping!",
	ping: "Pong!",
	pong: "Pung!",
	pung: "Pyng!",
	pyng: "Pang!"
} as const;

export default declare({
	Name: "ping",
	Aliases: ["pang", "peng", "pong", "pung", "pyng"],
	Cooldown: 5000,
	Description: "Ping!",
	Flags: ["pipe", "skip-banphrase"],
	Params: [],
	Whitelist_Response: null,
	Code: async function ping (context) {
		const linksAllowed = (!context.channel || context.channel.Links_Allowed);
		if (linksAllowed && randomInt(1, 1000) === 1) {
			const emote = await context.randomEmote("AlienDance", "AlienPls", "forsenPls", "SourPls", "DinoDance");
			return {
				success: true,
				reply: `Let us play Pong ${emote} ${emote} ${emote} https://youtu.be/cNAdtkSjSps`
			};
		}

		const uptime = new SupiDate().addSeconds(-process.uptime());
		const data: Record<string, string | number> = {
			Uptime: core.Utils.timeDelta(uptime, true),
			Temperature: await getTemperature(),
			"Used memory": core.Utils.formatByteSize(process.memoryUsage().rss, 0),
			Redis: (core.Cache.ready)
				? `${String(await core.Cache.server.dbsize())} keys`
				: "not online"
		};

		if (context.channel) {
			const type = context.channel.Banphrase_API_Type;
			const url = context.channel.Banphrase_API_URL;

			if (type && url) {
				const ping = await checkLatency(
					async () => sb.Banphrase.executeExternalAPI("test", type, url)
				);

				const result = (ping === null) ? "No response from API" : `${Math.trunc(ping)}ms`;
				data["Banphrase API"] = `Using ${type} API: ${url} (${result})`;
			}
		}

		if (context.platform.Name === "twitch") {
			const twitch = context.platform as TwitchPlatform; // @todo remove typecast when platform is discriminated by name
			const ping = twitch.websocketLatency;
			data["Latency to Twitch"] = (ping === null) ? "(no measurement yet)" : `${Math.trunc(ping)}ms`;
		}

		// @todo remove this typecast when context.invocation is a specific union in the future
		const invocation = context.invocation as "ping" | "pong" | "pung" | "pyng" | "pang" | "peng";
		const pongString = switchCharactersMap[invocation];

		return {
			success: true,
			reply: `${pongString} ${Object.entries(data).map(([name, value]) => `${name}: ${value}`).join("; ")}`
		};
	},
	Dynamic_Description: (prefix) => [
		"Pings the bot, checking if it's in the chat plus a bunch of other info.",
		"",

		`<code>${prefix}ping</code>`,
		"Pong! Latency: ..., Commands used: ..."
	]
});
