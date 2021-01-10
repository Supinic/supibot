module.exports = {
	Name: "ping",
	Aliases: ["pang","peng","pong","pung","pyng"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Ping!",
	Flags: ["pipe","skip-banphrase"],
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
		const getLoadAverages = require("os").loadavg;
		const promisify = require("util").promisify;
		const readFile = require("fs").promises.readFile;
		const exec = promisify(require("child_process").exec);
		const chars = {a: "e", e: "i", i: "o", o: "u", u: "y", y: "a"};
	
		const [temperature, memory] = await Promise.all([
			exec("/opt/vc/bin/vcgencmd measure_temp"),
			readFile("/proc/meminfo")
		]);
	
		const memoryData = String(memory).split("\n").filter(Boolean).map(i => Number(i.split(/:\s+/)[1].replace(/kB/, "")) * 1000);
		const pong = "P" + chars[context.invocation[1]] + "ng!";
	
		// const [swapTotal, swapFree] = memoryData.slice(14, 16);
		// const swapUsed = (swapTotal - swapFree);
	
		const [min1, min5] = getLoadAverages();
		const loadRatio = (min1 / min5);
		const loadDelta = Math.abs(1 - loadRatio);
		const loadDirection = (loadRatio > 1) ? "rising" : (loadRatio < 1) ? "falling" : "steady";
		const loadChange = (loadDelta > 0.10) ? " sharply" : (loadDelta > 0) ? " steadily" : "";
	
		const data = {
			Uptime: sb.Utils.timeDelta(sb.Master.started).replace("ago", "").trim(),
			Temperature: temperature.stdout.match(/([\d\.]+)/)[1] + "°C",
			"Free memory": sb.Utils.formatByteSize(memoryData[2], 0) + "/" + sb.Utils.formatByteSize(memoryData[0], 0),
			"CPU usage": (min5 === 0)
				? "No stats available"
				: `${loadDirection}${loadChange}`,
			// Swap: sb.Utils.formatByteSize(swapUsed, 0) + "/" + sb.Utils.formatByteSize(swapTotal, 0),
			"Commands used": await sb.Runtime.commands
		};
	
		if (sb.Cache) {
			data.Redis = (sb.Cache.active)
				? String(await sb.Cache.server.dbsize()) + " keys"
				: "not online"
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
			else {
				data["Banphrase API"] = "Not connected";
			}
		}
	
		if (context.platform.Name === "twitch") {
			const ping = await this.staticData.checkLatency(
				async () => context.platform.client.ping()
			);
	
			data["Latency to TMI"] = (ping === null)
				? "No response from Twitch (?)"
				: `${Math.trunc(ping)}ms`;
		}
	
		return {
			reply: pong + " " + Object.entries(data).map(([name, value]) => name + ": " + value).join("; ")
		};
	}),
	Dynamic_Description: (async (prefix) => {
		return [
			"Pings the bot, checking if it's alive, and a bunch of other data, like latency and commands used this session",
			"",
	
			`<code>${prefix}ping</code>`,
			"Pong! Latency: ..., Commands used: ..."
		];
	})
};