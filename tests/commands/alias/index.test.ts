/* eslint-disable @typescript-eslint/no-floating-promises */
import { it, describe, beforeEach } from "node:test";

// @ts-expect-error xd testing node stuff
import { Command } from "../../../classes/command.ts";
import aliasCommandDefinition from "../../../commands/alias/index.ts";
import checkSubcommand from "../../../commands/alias/subcommands/check.ts";

describe("Test xd", () => {
	it("test", () => console.log("xd"));

	// beforeEach(() => {
	// 	globalThis.core = {
	// 		Utils: {
	// 			tag: {
	// 				trim: (strings: TemplateStringsArray, ...values: Array<string | number>) => {
	// 					const result = [];
	// 					for (let i = 0; i < strings.length; i++) {
	// 						result.push(strings[i].replaceAll(/\s+/g, " "), values[i]);
	// 					}
	//
	// 					return result.join("").trim();
	// 				}
	// 			}
	// 		}
	// 	};
	// });

	it("base command", async () => {
		const command = new Command(aliasCommandDefinition);
		const context = Command.createFakeContext(command, {
			platformSpecificData: null,
			user: {},
			platform: {}
		});

		// await command.execute(context, "Test");
	});

	// it("test 123", async () => {
	//
	// 	try {
	// 		// const result = await command.execute(fakeContext, "alias", "list");
	// 		console.log({});
	// 	}
	// 	catch (e) {
	// 		console.log({ e });
	// 	}
	// });
});
