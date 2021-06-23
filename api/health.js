// noinspection JSUnusedGlobalSymbols
module.exports = {
	summary: async () => {
		const { freemem, totalmem } = require("os");
		const uptime = Math.trunc(process.uptime() * 1000);
		const started = new sb.Date().addMilliseconds(-uptime);
		const processMemory = process.memoryUsage();

		return {
			statusCode: 200,
			data: {
				memory: {
					system: {
						free: freemem(),
						total: totalmem()
					},
					process: processMemory
				},
				uptime: {
					time: uptime,
					started: started.valueOf()
				}
			}
		};
	}
};
