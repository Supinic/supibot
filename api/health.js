// noinspection JSUnusedGlobalSymbols
module.exports = {
	summary: async () => {
		const { freemem, totalmem } = require("os");
		const uptime = Math.trunc(process.uptime() * 1000);
		const started = new sb.Date().addMilliseconds(-uptime);

		return {
			statusCode: 200,
			data: {
				memory: {
					free: freemem(),
					total: totalmem()
				},
				uptime: {
					time: uptime,
					started: started.valueOf()
				}
			}
		};
	}
};
