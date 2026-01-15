import * as z from "zod";
import { declare } from "../../classes/command.js";
import rawForsenData from "./forsenE.json" with { type: "json" };

let forsenData: string[] | undefined;
const jsonSchema = z.object({ lines: z.array(z.string()) });
const MAXIMUM_REPEATS = 5;
const previousLines: string[] = [];

export default declare({
	Name: "forsenE",
	Aliases: null,
	Cooldown: 5000,
	Description: "Posts a random forsenE tweet.",
	Flags: ["pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: function forsenE (context) {
		forsenData ??= jsonSchema.parse(rawForsenData).lines;

		const eligibleLines = forsenData.filter(i => !previousLines.includes(i));
		const line = core.Utils.randArray(eligibleLines);

		previousLines.unshift(line);
		previousLines.splice(MAXIMUM_REPEATS);

		return {
			reply: `${line} ${context.invocation}`
		};
	},
	Dynamic_Description: null
});
