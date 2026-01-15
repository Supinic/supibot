import * as z from "zod";
import { declare } from "../../classes/command.js";
import rawDongers from "./dongers.json" with { type: "json" };

let dongers: string[] | undefined;
const dongerSchema = z.array(z.string());

export default declare({
	Name: "randomdonger",
	Aliases: ["rd"],
	Cooldown: 10000,
	Description: "Raise your dongers.",
	Flags: ["mention", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: function randomDonger () {
		dongers ??= dongerSchema.parse(rawDongers);
		return {
			reply: core.Utils.randArray(dongers)
		};
	},
	Dynamic_Description: null
});
