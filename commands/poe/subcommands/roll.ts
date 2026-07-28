import * as z from "zod";
import rawPoe1Data from "./poe1.json" with { type: "json" };
import type { PathOfExileSubcommandDefinition } from "../index.js";

const dataShape = z.object({
	ascendancies: z.array(z.string()),
	gems: z.array(z.object({
		name: z.string(),
		type: z.enum(["main", "additional"]),
		transfigured: z.literal(true).optional()
	}))
});

const { ascendancies, gems } = dataShape.parse(rawPoe1Data);
const additionalGems = gems.filter(i => i.type === "additional");
const skillGems = gems.filter(i => i.type === "main");

export default {
	name: "roll",
	title: "Roll a random build",
	aliases: [],
	description: ["Generates a build by taking a random skill gem and a random ascendancy and putting them together."],
	execute: (context) => {
		// @todo remove this type cast when context.invocation is a specific union in the future
		const invocation = context.invocation as "poe" | "poe2";
		if (invocation === "poe2") {
			return {
				success: false,
				reply: "Random builds are not supported for PoE 2 just yet!"
			};
		}

		const additional = core.Utils.randArray(additionalGems);
		const skill = core.Utils.randArray(skillGems);
		const ascendancy = core.Utils.randArray(ascendancies);

		return {
			reply: `${skill.name} + ${additional.name} ${ascendancy}`
		};
	}
} satisfies PathOfExileSubcommandDefinition;
