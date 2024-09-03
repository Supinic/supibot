import { randomInt } from "../../utils/command-utils";
import Command from "../../classes/command";

// @todo put these into a separate "standard command types" file
declare type CommandParamDefinition = {
	name: string;
	type: "string" | "number" | "date" | "regex";
};

declare type CommandResult = {
	success?: boolean;
	reply: string;
};

declare type CommandDefinition = {
	Name: string;
	Aliases: string[] | null;
	Author: string | null;
	Cooldown: number | null;
	Description: string | null;
	Flags: string[];
	Params: CommandParamDefinition[] | null;
	Whitelist_Response: string | null;
	initialize?: (this: Command) => Promise<void>;
	destroy?: (this: Command) => Promise<void>;
	Code: (this: Command, ...args: string[]) => Promise<CommandResult>;
	Dynamic_Description: () => Promise<string[]>;
};

export const definition = {
	Name: "%",
	Aliases: null,
	Author: "supinic",
	Cooldown: 5000,
	Description: "Rolls a random percentage between 0 and 100%.",
	Flags: ["mention", "pipe", "skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function percent () {
		const number = randomInt(0, 10_000);
		return {
			reply: `${number / 100}%`
		};
	}),
	Dynamic_Description: (async () => [
		"Rolls a random percentage!",
		"",

		`<code>$%</code>`,
		"Random percentage, between 0.00% to 100.00%"
	])
} satisfies CommandDefinition;
