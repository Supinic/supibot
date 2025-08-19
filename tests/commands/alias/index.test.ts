/* eslint-disable @typescript-eslint/no-floating-promises */
import { it, describe, after, beforeEach, test } from "node:test";
import assert from 'node:assert/strict';

// import { Command } from "../../../classes/command.ts";
// import aliasCommandDefinition from "../../../commands/alias/index.ts";

describe("Test xd", () => {
	it("test", async (t) => {
		const created: { args: any[]; stack: string }[] = [];

		// Replace setInterval with a spy that records call sites, then calls through
		const real = global.setInterval;
		t.mock.property(global, 'setInterval', ((...args: any[]) => {
			created.push({ args, stack: new Error().stack ?? '' });
			return real(...args);
		}) as any);


		console.log("xd");
		const x = await import("../../../classes/command.ts");

		console.log(created);

		// assert.equal(created.length, 0, 'Module should not start intervals on import');

	});

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
		// const command = new Command(aliasCommandDefinition);
		// const context = Command.createFakeContext(command, {
		// 	platformSpecificData: null,
		// 	user: {},
		// 	platform: {}
		// });

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
