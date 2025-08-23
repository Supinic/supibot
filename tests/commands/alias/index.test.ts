import { it, describe, beforeEach, mock, before } from "node:test";
import assert from "node:assert/strict";

import { SupiDate, Utils } from "supi-core";

import { Command } from "../../../classes/command.js";
import { FakeRow, FakeRecordset, createTestPlatform, createTestUser, createTestCommand } from "../../test-utils.js";
import type { User } from "../../../classes/user.js";
import type { Channel } from "../../../classes/channel.js";

const EXISTING_COMMANDS = ["EXISTING_COMMAND"];

type AliasData = {
	ID: number;
	User_Alias: User["ID"] | null;
	Channel: Channel["ID"] | null;
	Name: string;
	Command: Command["Name"] | null;
	Invocation: Command["Name"] | null;
	Arguments: string | null;
	Description: string | null;
	Parent: AliasData["ID"] | null;
	Restrictions: ("copy" | "link")[] | null;
	Created: SupiDate;
	Edited: SupiDate | null;
};

describe("$alias", async () => {
	let rows: FakeRow[] = [];
	let existingAliasMap: Record<string, Record<string, Partial<AliasData>> | undefined> = {};

	beforeEach(() => {
		rows = [];
		existingAliasMap = {};

		globalThis.core = {
			Utils: new Utils(),
			Query: {
				getRecordset: () => new FakeRecordset(),
				getRow: (schema: string, table: string) => {
					const row = new FakeRow(schema, table);
					rows.push(row);
					return row;
				}
			}
		} as unknown as (typeof globalThis.core);
	});

	const realAliasUtils = await import("../../../commands/alias/alias-utils.js");
	mock.module("../../../commands/alias/alias-utils.js", {
		namedExports: {
			...realAliasUtils, // keep ALL original named exports
			getAliasByNameAndUser: (aliasName: string, userId: number) => {
				const userAliases = existingAliasMap[userId];
				if (!userAliases) {
					return null;
				}

				return userAliases[aliasName] ?? null;
			},
			parseCommandName: (name: string) => (EXISTING_COMMANDS.includes(name)) ? createTestCommand({ Name: name }) : null
		}
	});

	const aliasCommandDefinition = (await import("../../../commands/alias/index.js")).default;
	const checkSubcommand = (await import("../../../commands/alias/subcommands/check.js")).default;

	const USERNAME = "test_user";
	const USER_ID = 1337;
	const command = new Command(aliasCommandDefinition);
	const user = createTestUser({ Name: USERNAME, ID: USER_ID });
	const platform = createTestPlatform();
	const context = Command.createFakeContext(command, {
		platformSpecificData: null,
		user,
		platform
	});

	it("provides link to details when no subcommand provided", async () => {
		const result = await command.execute(context);
		assert.ok(result.reply?.includes("https://"));
	});

	it("fails on invalid subcommand provided", async () => {
		const result = await command.execute(context, "DOES_NOT_EXIST");
		assert.strictEqual(result.success, false);
	});

	it("check: posts list of aliases", async () => {
		for (const alias of [checkSubcommand.name, ...checkSubcommand.aliases]) {
			const result = await command.execute(context, alias);
			assert.ok(result.reply?.includes(USERNAME));
		}
	});

	it("add: properly adds/edits provided alias", async () => {
		const result1 = await command.execute(context, "add");
		assert.strictEqual(result1.success, false, "Should fail on no alias name provided");

		const result2 = await command.execute(context, "add", "foo");
		assert.strictEqual(result2.success, false, "Should fail on no alias content provided");

		const result3 = await command.execute(context, "add", "foo", "NO_COMMAND");
		assert.strictEqual(result3.success, false, "Should fail on invalid command name provided");

		const aliasName = "foo";
		const commandName = EXISTING_COMMANDS[0];
		const result4 = await command.execute(context, "add", aliasName, commandName);
		assert.notStrictEqual(result4.success, false, "Should pass");

		const row4 = rows.pop();
		assert.ok(row4);
		assert.deepEqual(row4.values.Command, commandName);
		assert.strictEqual(row4.values.Name, aliasName);
		assert.strictEqual(row4.values.Arguments, null);
		assert.strictEqual(row4.values.User_Alias, USER_ID);

		existingAliasMap = {
			[USER_ID]: {
				[row4.values.Name]: row4.values
			}
		};

		const result5 = await command.execute(context, "add", aliasName, commandName);
		assert.strictEqual(result5.success, false, "Should fail when trying to add an existing alias");

		const result6 = await command.execute(context, "upsert", aliasName, commandName);
		assert.notStrictEqual(result6.success, false, "Should overwrite existing alias");
	});
});
