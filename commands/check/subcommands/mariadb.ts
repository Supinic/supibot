import * as z from "zod";
import { SupiDate } from "supi-core";
import type { CheckSubcommandDefinition } from "../index.js";

const memoryUsageSchema = z.object({
	data: z.object({
		VmRSS: z.number(),
		VmSwap: z.number()
	})
});

export default {
	name: "mariadb",
	title: "MariaDB process memory usage",
	aliases: ["maria"],
	description: ["Checks for the current memory usage of the MariaDB database process, running on Supinic's Raspberry Pi 4."],
	execute: async () => {
		const response = await core.Got.get("RaspberryPi4")({
			url: "maria/memoryUsage",
			throwHttpErrors: false
		});

		const { data: memoryData } = memoryUsageSchema.parse(response.body);
		const residental = core.Utils.formatByteSize(memoryData.VmRSS, 2);
		const swap = core.Utils.formatByteSize(memoryData.VmSwap, 2);

		if (response.statusCode !== 200) {
			return {
				success: false,
				reply: "Could not check for the process memory usage!"
			};
		}

		const uptimeVariable = await core.Query.getRecordset<string>(rs => rs
			.select("VARIABLE_VALUE AS Uptime")
			.from("INFORMATION_SCHEMA", "GLOBAL_STATUS")
			.where("VARIABLE_NAME = %s", "Uptime")
			.limit(1)
			.single()
			.flat("Uptime")
		);

		const uptime = core.Utils.timeDelta(new SupiDate().addSeconds(Number(uptimeVariable)), true);
		return {
			reply: `The MariaDB process is running for ${uptime}, and it is currently using ${residental} of memory + ${swap} in swap.`
		};
	}
} satisfies CheckSubcommandDefinition;
