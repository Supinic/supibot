import { randomInt } from "../../utils/command-utils.js";
const promisify = require("node:util").promisify;
const exec = promisify(require("node:child_process").exec);

const checkLatency = async (callback, ...args) => {
	try {
		const start = process.hrtime.bigint();
		await callback(...args);

		return sb.Utils.round(Number(process.hrtime.bigint() - start) / 1_000_000, 3);
	}
	catch {
		return null;
	}
};
const switchCharactersMap = { a: "e", e: "i", i: "o", o: "u", u: "y", y: "a" };

export default {
	Name: "ping",
	Aliases: ["pang","peng","pong","pung","pyng"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Ping!",
	Flags: ["pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	/**
	 * @param {Context} context
	 */
	Code: async function ping (context) {
		const [temperatureResult] = await Promise.allSettled([
			exec("vcgencmd measure_temp")
		]);

		const temperature = (temperatureResult.value)
			? `${temperatureResult.value.stdout.match(/([\d.]+)/)[1]}°C`
			: "N/A";

		const uptime = new sb.Date().addSeconds(-process.uptime());
		const data = {
			Uptime: sb.Utils.timeDelta(uptime, true),
			Temperature: temperature,
			"Used memory": sb.Utils.formatByteSize(process.memoryUsage().rss, 0)
		};

		if (sb.Cache) {
			data.Redis = (sb.Cache.ready)
				? `${String(await sb.Cache.server.dbsize())} keys`
				: "not online";
		}

		if (context.channel) {
			const type = context.channel.Banphrase_API_Type;
			const url = context.channel.Banphrase_API_URL;

			if (type && url) {
				const ping = await checkLatency(
					async () => sb.Banphrase.executeExternalAPI("test", type, url)
				);

				const result = (ping === null)
					? "No response from API"
					: `${Math.trunc(ping)}ms`;

				data["Banphrase API"] = `Using ${type} API: ${url} (${result})`;
			}
		}

		if (context.platform.Name === "twitch") {
			const ping = context.platform.websocketLatency;
			data["Latency to Twitch"] = (ping === null)
				? "(no measurement yet)"
				: `${Math.trunc(ping)}ms`;
		}

		const pongString = `P${switchCharactersMap[context.invocation[1]]}ng!`;
		if (pongString === "Ping!" && randomInt(1, 10) === 1) {
			const emote = await context.randomEmote("AlienDance", "AlienPls", "forsenPls", "SourPls", "DinoDance");
			return {
				reply: `Let's play Pong ${emote} ${emote} ${emote} https://youtu.be/cNAdtkSjSps`
			};
		}

		return {
			reply: `${pongString} ${Object.entries(data).map(([name, value]) => `${name}: ${value}`).join("; ")}`
		};
	},
	Dynamic_Description: (async (prefix) => [
		"Pings the bot, checking if it's alive, and a bunch of other data, like latency and commands used this session",
		"",

		`<code>${prefix}ping</code>`,
		"Pong! Latency: ..., Commands used: ..."
	])
};
