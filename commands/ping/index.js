module.exports = {
	Name: "ping",
	Aliases: ["pang","peng","pong","pung","pyng"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Ping!",
	Flags: ["pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		checkLatency: async (callback, ...args) => {
			try {
				const start = process.hrtime.bigint();
				await callback(...args);

				return sb.Utils.round(Number(process.hrtime.bigint() - start) / 1.0e6, 3);
			}
			catch {
				return null;
			}
		}
	})),
	Code: (async function ping (context) {
		const promisify = require("util").promisify;
		const exec = promisify(require("child_process").exec);

		const [temperatureResult] = await Promise.allSettled([
			exec("/opt/vc/bin/vcgencmd measure_temp")
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
			data.Redis = (sb.Cache.active)
				? `${String(await sb.Cache.server.dbsize())} keys`
				: "not online";
		}

		if (context.channel) {
			const type = context.channel.Banphrase_API_Type;
			const url = context.channel.Banphrase_API_URL;

			if (type && url) {
				const ping = await this.staticData.checkLatency(
					async () => sb.Banphrase.executeExternalAPI("test", type, url)
				);

				const result = (ping === null)
					? "No response from API"
					: `${Math.trunc(ping)}ms`;

				data["Banphrase API"] = `Using ${type} API: ${url} (${result})`;
			}
		}

		if (context.platform.Name === "twitch") {
			const ping = await this.staticData.checkLatency(
				async () => context.platform.client.ping()
			);

			data["Latency to Twitch"] = (ping === null)
				? "No response?"
				: `${Math.trunc(ping)}ms`;
		}

		const chars = { a: "e", e: "i", i: "o", o: "u", u: "y", y: "a" };
		const pongString = `P${chars[context.invocation[1]]}ng!`;
		return {
			reply: `${pongString} ${Object.entries(data).map(([name, value]) => `${name}: ${value}`).join("; ")}`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		"Pings the bot, checking if it's alive, and a bunch of other data, like latency and commands used this session",
		"",

		`<code>${prefix}ping</code>`,
		"Pong! Latency: ..., Commands used: ..."
	])
};
