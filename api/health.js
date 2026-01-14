import { freemem, totalmem } from "node:os";
import { SupiDate } from "supi-core";

export default {
	summary: async () => {
		const uptime = Math.trunc(process.uptime() * 1000);
		const started = new SupiDate().addMilliseconds(-uptime);
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
