import { it, describe, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { inspect } from "node:util";

function logBlockingHandlesRequests (label: string) {
	// Undocumented but extremely useful
	// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call
	const handles: string[] = (process as unknown as any)._getActiveHandles?.() ?? [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call
	const requests: string[] = (process as unknown as any)._getActiveRequests?.() ?? [];

	console.log(`\n=== ${label} ===`);
	console.log(`Active handles (${handles.length}):`);
	console.log(inspect(handles, { depth: 3, showHidden: true }));
	console.log(`Active requests (${requests.length}):`);
	console.log(inspect(requests, { depth: 3, showHidden: true }));
}

import { Command } from "../../../classes/command.js";
import { User } from "../../../classes/user.js";
import { TwitchPlatform } from "../../../platforms/twitch.js";

import aliasCommandDefinition from "../../../commands/alias/index.js";

describe("Test xd", () => {
	beforeEach(() => {
		globalThis.core = {
			Utils: {
				tag: {
					trim: (strings: TemplateStringsArray, ...values: Array<string | number>) => {
						const result = [];
						for (let i = 0; i < strings.length; i++) {
							result.push(strings[i].replaceAll(/\s+/g, " "), values[i]);
						}

						return result.join("").trim();
					}
				}
			}
		} as (typeof globalThis.core);
	});

	const createTestUser = (opts: { Name?: string } = {}) => new User({
		ID: 1,
		Name: opts.Name ?? "sample_user",
		Discord_ID: null,
		Twitch_ID: null,
		Started_Using: null
	});
	const createTestPlatform = () => new TwitchPlatform({
		ID: 1,
		selfId: "123",
		logging: {},
		platform: {},
		messageLimit: 500,
		selfName: "Foo",
		active: true
	});

	it("base command", async () => {
		const command = new Command(aliasCommandDefinition);
		const user = createTestUser();
		const platform = createTestPlatform();

		const context = Command.createFakeContext(command, {
			platformSpecificData: null,
			user,
			platform
		});

		const result = await command.execute(context, "Test");
		console.log({ result });

		const result2 = await command.execute(context, "check");
		console.log({ result2 });
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
