import { it, describe, beforeEach, mock, before } from "node:test";
import assert from "node:assert/strict";

import type { SupiDate } from "supi-core";
import type { User } from "../../../classes/user.js";
import { Command } from "../../../classes/command.js";
import type { Channel } from "../../../classes/channel.js";

import {
	createTestPlatform,
	createTestUser,
	createTestCommand,
	expectCommandResultFailure,
	expectCommandResultSuccess,
	TestWorld
} from "../../test-utils.js";

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
	let existingAliasMap: Record<string, Record<string, Partial<AliasData>> | undefined> = {};

	const world = new TestWorld();
	beforeEach(() => {
		world.reset();
		world.install();
		existingAliasMap = {};
	});

	const realAliasUtils = await import("../../../commands/alias/alias-utils.js");
	mock.module("../../../commands/alias/alias-utils.js", {
		namedExports: {
			...realAliasUtils,
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

	const BASE_USERNAME = "test_user";
	const BASE_USER_ID = 1337;

	const baseCommand = new Command(aliasCommandDefinition);
	const baseUser = createTestUser({ Name: BASE_USERNAME, ID: BASE_USER_ID });
	const basePlatform = createTestPlatform();
	const baseContext = Command.createFakeContext(baseCommand, {
		platformSpecificData: null,
		user: baseUser,
		platform: basePlatform
	});

	it("provides link to details when no subcommand provided", async () => {
		const result = await baseCommand.execute(baseContext);
		expectCommandResultSuccess(result, "This command", "create", "command aliases", "https://");
	});

	it("fails on invalid subcommand provided", async () => {
		const result = await baseCommand.execute(baseContext, "DOES_NOT_EXIST");
		expectCommandResultFailure(result, "Invalid sub-command", "Check", "help", "https://");
	});

	describe("add", () => {
		it("0 args: should fail, no alias name provided", async () => {
			const result = await baseCommand.execute(baseContext, "add");
			expectCommandResultFailure(result, "didn't provide", "name", "command");
		});

		it("1 arg: should fail, no command provided", async () => {
			const result = await baseCommand.execute(baseContext, "add", "foo");
			expectCommandResultFailure(result, "didn't provide", "name", "command");
		});

		it("2 args: should fail when command does not exist", async () => {
			const NONEXISTENT_COMMAND = "NO_COMMAND";
			const result = await baseCommand.execute(baseContext, "add", "foo", NONEXISTENT_COMMAND);
			expectCommandResultFailure(result, "Cannot create", "command", NONEXISTENT_COMMAND, "does not exist");
		});

		it("2 args: should create a new alias", async () => {
			const aliasName = "foo";
			const commandName = EXISTING_COMMANDS[0];

			const result = await baseCommand.execute(baseContext, "add", aliasName, commandName);
			expectCommandResultSuccess(result, "created");

			const row = world.rows.pop();
			assert.ok(row, "Expected a Row to be created");
			assert.ok(row.stored, "Expected a Row to be stored");
			assert.strictEqual(row.loaded, false, "Expected a Row to not be loaded");

			assert.strictEqual(row.values.Name, aliasName);
			assert.strictEqual(row.values.Command, commandName);
			assert.strictEqual(row.values.Arguments, null);
			assert.strictEqual(row.values.User_Alias, BASE_USER_ID);

			assert.strictEqual(world.rows.length, 0);
		});

		it("2 args: should fail when adding an already existing alias", async () => {
			const aliasName = "foo";
			const commandName = EXISTING_COMMANDS[0];

			existingAliasMap[BASE_USER_ID] = {
				[aliasName]: {
					Name: aliasName,
					Command: commandName
				}
			};

			const result = await baseCommand.execute(baseContext, "add", aliasName, commandName);
			expectCommandResultFailure(result, "Cannot add", "alias", aliasName, "already have one");
		});

		it("2+ args: should override when upserting an already existing alias", async () => {
			const aliasName = "foo";
			const commandName = EXISTING_COMMANDS[0];
			const testArgs = ["foo", "bar", "baz"];

			existingAliasMap[BASE_USER_ID] = {
				[aliasName]: {
					Name: aliasName,
					Command: commandName
				}
			};

			const result = await baseCommand.execute(baseContext, "upsert", aliasName, commandName, ...testArgs);
			expectCommandResultSuccess(result, "alias", aliasName, "replaced", "successfully");

			const row = world.rows.pop();
			assert.ok(row, "Expected a Row to be saved");
			assert.ok(row.updated, "Expected Row to be updated");

			assert.strictEqual(row.values.Name, aliasName);
			assert.strictEqual(row.values.Command, commandName);
			assert.strictEqual(row.values.Arguments, JSON.stringify(testArgs));
			assert.strictEqual(row.values.User_Alias, BASE_USER_ID);

			assert.strictEqual(world.rows.length, 0);
		});

		it("2 args: should reject non-conforming alias names (illegal character)", async () => {
			const commandName = EXISTING_COMMANDS[0];
			const result = await baseCommand.execute(baseContext, "add", "@@@", commandName);
			expectCommandResultFailure(result, "alias name is not valid");
		});

		it("2 args: should reject non-conforming alias names (too short)", async () => {
			const commandName = EXISTING_COMMANDS[0];
			const result = await baseCommand.execute(baseContext, "add", "F", commandName);
			expectCommandResultFailure(result, "alias name is not valid");
		});

		it("2 args: should reject non-conforming alias names (too short)", async () => {
			const commandName = EXISTING_COMMANDS[0];
			const result = await baseCommand.execute(baseContext, "add", "F".repeat(31), commandName);
			expectCommandResultFailure(result, "alias name is not valid");
		});
	});

	describe("check", () => {
		it ("0 args: should post a link when nothing is provided", async () => {
			const result = await baseCommand.execute(baseContext, "check");
			expectCommandResultSuccess(result, "List of your aliases", BASE_USERNAME);
		});

		it ("1 arg: should fail when neither user nor alias exists", async () => {
			world.queueRsData([]); // No aliases for current user

			const result = await baseCommand.execute(baseContext, "check", "NO_COMMAND");
			expectCommandResultFailure(result, "Could not match your input", "username", "your aliases");
		});

		it ("1 arg: should fail when provided user exists but has no aliases", async () => {
			const TARGET_USER = "bob";
			world.allowUser(TARGET_USER);
			world.queueRsData([]); // No aliases for current user
			world.queueRsData([]); // No aliases for target user

			const result = await baseCommand.execute(baseContext, "check", TARGET_USER);
			expectCommandResultFailure(result, "Could not match your input", "username", "your aliases");
		});

		it ("1 arg: should suceed when provided user exists and has some aliases", async () => {
			const TARGET_USER = "bob";
			world.allowUser(TARGET_USER);
			world.queueRsData([]); // No aliases for current user
			world.queueRsData([{}]); // Some alias for target user

			const result = await baseCommand.execute(baseContext, "check", TARGET_USER);
			expectCommandResultSuccess(result, "List of their aliases", "https://", TARGET_USER);
		});

		it ("1 arg: should succeed when base user owns the provided alias", async () => {
			const ALIAS_NAME = "Foo";
			world.queueRsData([ALIAS_NAME]);
			existingAliasMap[baseUser.ID] = { Foo: {} };

			const result = await baseCommand.execute(baseContext, "check", ALIAS_NAME);
			expectCommandResultSuccess(result, "Your alias", ALIAS_NAME, "has this definition");
		});

		it ("2 args: should succeed when provided user owns the provided alias", async () => {
			const ALIAS_NAME = "Foo";
			const TARGET_USER = "Bob";
			const TARGET_USER_ID = 123;
			const BASE_ALIAS_COMMAND = "test";

			world.queueRsData([]);
			world.queueRsData([ALIAS_NAME]);
			world.allowUser(TARGET_USER);
			world.setUserId(TARGET_USER, TARGET_USER_ID);

			existingAliasMap[TARGET_USER_ID] = {
				[ALIAS_NAME]: { Command: BASE_ALIAS_COMMAND }
			};

			const result = await baseCommand.execute(baseContext, "check", TARGET_USER, ALIAS_NAME);
			console.log({ result });
			expectCommandResultSuccess(result, "Their alias", ALIAS_NAME, "has this definition");
		});

		it ("2 args: should fail when provided user does not own the provided alias", async () => {
			const ALIAS_NAME = "Foo";
			const DIFFERENT_ALIAS_NAME = "Bar";
			const TARGET_USER = "Bob";
			const TARGET_USER_ID = 123;

			world.queueRsData([]);
			world.queueRsData([ALIAS_NAME]);
			world.allowUser(TARGET_USER);
			world.setUserId(TARGET_USER, TARGET_USER_ID);

			existingAliasMap[TARGET_USER_ID] = {
				[DIFFERENT_ALIAS_NAME]: {}
			};

			const result = await baseCommand.execute(baseContext, "check", TARGET_USER, ALIAS_NAME);
			expectCommandResultFailure(result, "They don't have", ALIAS_NAME, "alias");
		});

		// alias definition + message = too long -> link
		// different result for $alias code -> should post definition and no fluff
		// checking user - user doesn't exist
		// checking linked alias -> exists
		// checking linked alias -> original is deleted
	});

	describe("copy", () => {
		it("0 args: should fail, no user name provided", async () => {
			const resultCopy = await baseCommand.execute(baseContext, "copy");
			expectCommandResultFailure(resultCopy, "No", "username");

			const resultCopyplace = await baseCommand.execute(baseContext, "copyplace");
			expectCommandResultFailure(resultCopyplace, "No", "username");
		});

		it("1 arg: should fail, no alias name provided", async () => {
			const result = await baseCommand.execute(baseContext, "copy", "Bob");
			expectCommandResultFailure(result, "No", "alias");
		});

		it("2 arg: should fail, incorrect user provided", async () => {
			const result = await baseCommand.execute(baseContext, "copy", "Bob", "foo");
			expectCommandResultFailure(result, "Invalid", "user");
		});

		it("2 arg: should fail, illegal alias provided (too short)", async () => {
			const TARGET_USER = "bob";
			world.allowUser(TARGET_USER);

			const result = await baseCommand.execute(baseContext, "copyplace", TARGET_USER, "f");
			expectCommandResultFailure(result, "copied alias", "name", "not valid");
		});

		it("2 arg: should fail, illegal alias provided (too long)", async () => {
			const TARGET_USER = "bob";
			world.allowUser(TARGET_USER);

			const result = await baseCommand.execute(baseContext, "copyplace", TARGET_USER, "f".repeat(31));
			expectCommandResultFailure(result, "copied alias", "name", "not valid");
		});

		it("2 arg: should fail, illegal alias provided (too long)", async () => {
			const TARGET_USER = "bob";
			world.allowUser(TARGET_USER);

			const result = await baseCommand.execute(baseContext, "copyplace", TARGET_USER, "$$$");
			expectCommandResultFailure(result, "copied alias", "name", "not valid");
		});

		it("2 arg: should fail, user does not own alias", async () => {
			const TARGET_USER = "bob";
			const TARGET_ALIAS = "foo";
			world.allowUser(TARGET_USER);

			const result = await baseCommand.execute(baseContext, "copy", TARGET_USER, TARGET_ALIAS);
			expectCommandResultFailure(result, "User", TARGET_USER, "doesn't have", TARGET_ALIAS);
		});

		it("2 arg: should fail, user owns alias but it is linked", async () => {
			const TARGET_USER = "bob";
			const TARGET_ALIAS = "foo";
			const TARGET_USER_ID = 123;

			world.queueRsData(undefined);
			existingAliasMap[TARGET_USER_ID] = {
				[TARGET_ALIAS]: {
					Channel: null,
					User_Alias: TARGET_USER_ID,
					Parent: 1,
					Command: null
				}
			};

			world.allowUser(TARGET_USER);
			world.setUserId(TARGET_USER, TARGET_USER_ID);

			const result = await baseCommand.execute(baseContext, "copy", TARGET_USER, TARGET_ALIAS);
			expectCommandResultFailure(result, "cannot copy", "original", "deleted");
		});

		it("2 arg: should fail, user owns alias but it is copy-restricted", async () => {
			const TARGET_USER = "bob";
			const TARGET_ALIAS = "foo";
			const TARGET_USER_ID = 123;

			world.queueRsData(undefined);
			existingAliasMap[TARGET_USER_ID] = {
				[TARGET_ALIAS]: {
					User_Alias: TARGET_USER_ID,
					Parent: null,
					Command: "foo",
					Channel: null,
					Restrictions: ["copy"]
				}
			};

			world.allowUser(TARGET_USER);
			world.setUserId(TARGET_USER, TARGET_USER_ID);

			const result = await baseCommand.execute(baseContext, "copy", TARGET_USER, TARGET_ALIAS);
			expectCommandResultFailure(result, "cannot copy", "prevented new copies");
		});

		it("2 arg: should fail, copy - name collision", async () => {
			const TARGET_USER = "bob";
			const TARGET_ALIAS = "foo";
			const TARGET_USER_ID = 123;

			world.queueRsData(undefined);
			existingAliasMap[TARGET_USER_ID] = {
				[TARGET_ALIAS]: {
					User_Alias: TARGET_USER_ID,
					Parent: null,
					Command: "foo",
					Channel: null
				}
			};
			existingAliasMap[BASE_USER_ID] = {
				[TARGET_ALIAS]: {
					User_Alias: BASE_USER_ID,
					Parent: null,
					Command: "foo",
					Channel: null
				}
			};

			world.allowUser(TARGET_USER);
			world.setUserId(TARGET_USER, TARGET_USER_ID);

			const result = await baseCommand.execute(baseContext, "copy", TARGET_USER, TARGET_ALIAS);
			expectCommandResultFailure(result, "Cannot copy", TARGET_ALIAS, "already have it");
		});

		it("2 arg: should succeed, copyplace - name collision", async () => {
			const TARGET_USER = "bob";
			const TARGET_ALIAS = "foo";
			const TARGET_USER_ID = 123;

			existingAliasMap[TARGET_USER_ID] = {
				[TARGET_ALIAS]: {
					Name: TARGET_ALIAS,
					User_Alias: TARGET_USER_ID,
					Command: "foo",
					Invocation: "foobar",
					Channel: null,
					Arguments: "bar baz"
				}
			};
			existingAliasMap[BASE_USER_ID] = {
				[TARGET_ALIAS]: {
					Name: TARGET_ALIAS,
					User_Alias: BASE_USER_ID,
					Command: "bar",
					Channel: null,
					Arguments: null
				}
			};

			world.allowUser(TARGET_USER);
			world.setUserId(TARGET_USER, TARGET_USER_ID);

			const result = await baseCommand.execute(baseContext, "copyplace", TARGET_USER, TARGET_ALIAS);
			expectCommandResultSuccess(result, TARGET_ALIAS, "copied", "replaced");

			const row = world.rows.pop();
			assert.ok(row);

			const expectedAlias = existingAliasMap[TARGET_USER_ID][TARGET_ALIAS];
			assert.strictEqual(row.values.Command, expectedAlias.Command);
			assert.strictEqual(row.values.Arguments, expectedAlias.Arguments);
			assert.strictEqual(row.values.Invocation, expectedAlias.Invocation);
			assert.strictEqual(row.values.Parent, undefined);

			assert.strictEqual(world.rows.length, 0);
		});

		it("2 arg: should succeed on correct usage", async () => {
			const TARGET_USER = "bob";
			const TARGET_ALIAS = "foo";
			const TARGET_USER_ID = 123;

			existingAliasMap[TARGET_USER_ID] = {
				[TARGET_ALIAS]: {
					Name: TARGET_ALIAS,
					User_Alias: TARGET_USER_ID,
					Command: "foo",
					Invocation: "foobar",
					Channel: null,
					Arguments: "bar baz"
				}
			};

			world.allowUser(TARGET_USER);
			world.setUserId(TARGET_USER, TARGET_USER_ID);

			const result = await baseCommand.execute(baseContext, "copy", TARGET_USER, TARGET_ALIAS);
			expectCommandResultSuccess(result, TARGET_ALIAS, "copied", "success");

			const row = world.rows.pop();
			assert.ok(row);

			const expectedAlias = existingAliasMap[TARGET_USER_ID][TARGET_ALIAS];
			assert.strictEqual(row.values.Command, expectedAlias.Command);
			assert.strictEqual(row.values.Arguments, expectedAlias.Arguments);
			assert.strictEqual(row.values.Invocation, expectedAlias.Invocation);
			assert.strictEqual(row.values.Parent, undefined);

			assert.strictEqual(world.rows.length, 0);
		});

		it("2 arg: should succeed on copying a linked alias (conversion)", async () => {
			const TARGET_USER = "bob";
			const TARGET_ALIAS = "foo";
			const TARGET_USER_ID = 123;

			const LINKED_ALIAS_ID = 234;
			const LINKED_USER_ID = 234;

			const linkedAlias = {
				ID: LINKED_ALIAS_ID,
				User_Alias: LINKED_USER_ID,
				Command: "bar",
				Channel: null,
				Arguments: "bar baz",
				Invocation: "foo"
			};
			world.queueRsData(linkedAlias);

			existingAliasMap[TARGET_USER_ID] = {
				[TARGET_ALIAS]: {
					Name: TARGET_ALIAS,
					User_Alias: TARGET_USER_ID,
					Parent: LINKED_ALIAS_ID,
					Command: null,
					Invocation: null,
					Channel: null,
					Arguments: null
				}
			};

			world.allowUser(TARGET_USER);
			world.setUserId(TARGET_USER, TARGET_USER_ID);

			const result = await baseCommand.execute(baseContext, "copy", TARGET_USER, TARGET_ALIAS);
			expectCommandResultSuccess(result, TARGET_ALIAS, "copied", "success");

			const row = world.rows.pop();
			assert.ok(row);

			assert.strictEqual(row.values.Command, linkedAlias.Command);
			assert.strictEqual(row.values.Arguments, linkedAlias.Arguments);
			assert.strictEqual(row.values.Invocation, linkedAlias.Invocation);
			assert.strictEqual(row.values.Parent, linkedAlias.ID);

			assert.strictEqual(world.rows.length, 0);
		});
	});

	describe("describe", () => {
		it("0 args: should fail, no alias name provided", async () => {
			const result = await baseCommand.execute(baseContext, "describe");
			expectCommandResultFailure(result, "didn't provide", "name", "command");
		});

		it("1 arg: should fail, alias not owned", async () => {
			const ALIAS_NAME = "foo";
			const result = await baseCommand.execute(baseContext, "describe", ALIAS_NAME);
			expectCommandResultFailure(result, "don't have", ALIAS_NAME);
		});

		it("1 arg: should succeed with empty description (reset)", async () => {
			const ALIAS_NAME = "foo";
			existingAliasMap[BASE_USER_ID] = {
				[ALIAS_NAME]: { Name: ALIAS_NAME, Command: null }
			};

			const result = await baseCommand.execute(baseContext, "describe", ALIAS_NAME);
			expectCommandResultSuccess(result, "description of your alias", ALIAS_NAME, "reset");

			const row = world.rows.pop();
			assert.ok(row, "Expected a Row to be saved");
			assert.ok(row.updated, "Expected Row to be updated");
			assert.strictEqual(row.values.Description, null);
			assert.strictEqual(world.rows.length, 0);
		});

		it("2 args: should succeed with literal \"none\" (reset)", async () => {
			const ALIAS_NAME = "bar";
			existingAliasMap[BASE_USER_ID] = {
				[ALIAS_NAME]: { Name: ALIAS_NAME, Command: null }
			};

			const result = await baseCommand.execute(baseContext, "describe", ALIAS_NAME, "none");
			expectCommandResultSuccess(result, "description of your alias", ALIAS_NAME, "reset");

			const row = world.rows.pop();
			assert.ok(row, "Expected a Row to be saved");
			assert.ok(row.updated, "Expected Row to be updated");
			assert.strictEqual(row.values.Description, null);
			assert.strictEqual(world.rows.length, 0);
		});

		it("2+ args: should fail when description is too long", async () => {
			const ALIAS_NAME = "foo";
			existingAliasMap[BASE_USER_ID] = {
				[ALIAS_NAME]: { Name: ALIAS_NAME, Command: null }
			};

			const tooLong = "x".repeat(realAliasUtils.ALIAS_DESCRIPTION_LIMIT + 1);
			const result = await baseCommand.execute(baseContext, "describe", ALIAS_NAME, tooLong);
			expectCommandResultFailure(result, "description is too long", String(realAliasUtils.ALIAS_DESCRIPTION_LIMIT));
		});

		it("2+ args: should succeed and set description", async () => {
			const ALIAS_NAME = "baz";
			const DESCRIPTION = "A short, helpful description.";

			existingAliasMap[BASE_USER_ID] = {
				[ALIAS_NAME]: { Name: ALIAS_NAME, Command: null }
			};

			const result = await baseCommand.execute(baseContext, "describe", ALIAS_NAME, DESCRIPTION);
			expectCommandResultSuccess(result, "description of your alias", ALIAS_NAME, "updated");

			const row = world.rows.pop();
			assert.ok(row, "Expected a Row to be saved");
			assert.ok(row.updated, "Expected Row to be updated");
			assert.strictEqual(row.values.Description, DESCRIPTION);

			assert.strictEqual(world.rows.length, 0);
		});
	});

	describe("duplicate", () => {
		it("0 args: should fail, no alias name(s) provided", async () => {
			const result = await baseCommand.execute(baseContext, "duplicate");
			expectCommandResultFailure(result, "must provide", "existing", "new", "alias", "name");
		});

		it("1 arg: should fail, no new alias name provided", async () => {
			const result = await baseCommand.execute(baseContext, "duplicate", "foo");
			expectCommandResultFailure(result, "must provide", "existing", "new", "alias", "name");
		});

		it("2 args: should fail when new alias name is illegal", async () => {
			const OLD = "foo";
			existingAliasMap[BASE_USER_ID] = {
				[OLD]: {
					Name: OLD,
					User_Alias: BASE_USER_ID,
					Command: "echo",
					Invocation: "foo",
					Arguments: "bar baz",
					Parent: null,
					Channel: null
				}
			};

			const result = await baseCommand.execute(baseContext, "duplicate", OLD, "$$$");
			expectCommandResultFailure(result, "alias", "name", "not valid");
		});

		it("2 args: should fail when old alias is not owned", async () => {
			const result = await baseCommand.execute(baseContext, "duplicate", "foo", "bar");
			expectCommandResultFailure(result, "don't have", "foo");
		});

		it("2 args: should fail when old alias is linked", async () => {
			const OLD = "linked";
			existingAliasMap[BASE_USER_ID] = {
				[OLD]: {
					Name: OLD,
					User_Alias: BASE_USER_ID,
					Parent: 1,
					Command: null,
					Invocation: null,
					Channel: null,
					Arguments: null
				}
			};

			const result = await baseCommand.execute(baseContext, "duplicate", OLD, "newname");
			expectCommandResultFailure(result, "cannot duplicate", "links", "aliases");
		});

		it("2 args: should fail when new alias already exists", async () => {
			const OLD = "foo";
			const NEW = "bar";
			existingAliasMap[BASE_USER_ID] = {
				[OLD]: {
					Name: OLD,
					User_Alias: BASE_USER_ID,
					Command: "cmd",
					Invocation: "call",
					Arguments: "x y",
					Parent: null,
					Channel: null
				},
				[NEW]: {
					Name: NEW,
					User_Alias: BASE_USER_ID,
					Command: "other"
				}
			};

			const result = await baseCommand.execute(baseContext, "duplicate", OLD, NEW);
			expectCommandResultFailure(result, "already", "have", NEW);
		});

		it("2 args: should succeed and create a duplicate linked to the original", async () => {
			const OLD = "foo";
			const NEW = "bar";
			const OLD_ID = 777;

			existingAliasMap[BASE_USER_ID] = {
				[OLD]: {
					ID: OLD_ID,
					Name: OLD,
					User_Alias: BASE_USER_ID,
					Command: "echo",
					Invocation: "foo",
					Arguments: "bar baz",
					Parent: null,
					Channel: null
				}
			};

			const result = await baseCommand.execute(baseContext, "duplicate", OLD, NEW);
			expectCommandResultSuccess(result, "duplicated", OLD, NEW);

			const row = world.rows.pop();
			assert.ok(row, "Expected a Row to be saved");
			assert.strictEqual(row.values.Command, "echo");
			assert.strictEqual(row.values.Invocation, "foo");
			assert.strictEqual(row.values.Arguments, "bar baz");
			assert.strictEqual(row.values.Description, null);
			assert.strictEqual(row.values.Parent, OLD_ID);

			assert.strictEqual(world.rows.length, 0);
		});
	});

	describe("edit", () => {
		it("0 args: should fail, no alias name provided", async () => {
			const result = await baseCommand.execute(baseContext, "edit");
			expectCommandResultFailure(result, "No alias", "command", "name provided");
		});

		it("1 arg: should fail, no command provided", async () => {
			const ALIAS_NAME = "foo";
			existingAliasMap[BASE_USER_ID] = {
				[ALIAS_NAME]: {
					Name: ALIAS_NAME,
					User_Alias: BASE_USER_ID,
					Command: "oldcmd",
					Invocation: "old",
					Arguments: "a b",
					Parent: null,
					Channel: null
				}
			};

			const result = await baseCommand.execute(baseContext, "edit", ALIAS_NAME);
			expectCommandResultFailure(result, "No alias", "command", "name provided");
		});

		it("2 args: should fail when alias is not owned", async () => {
			const [cmd] = EXISTING_COMMANDS;
			const aliasName = "notmine";
			const result = await baseCommand.execute(baseContext, "edit", aliasName, cmd);
			expectCommandResultFailure(result, "don't have", aliasName);
		});

		it("2 args: should fail when command does not exist", async () => {
			const ALIAS_NAME = "bar";
			existingAliasMap[BASE_USER_ID] = {
				[ALIAS_NAME]: {
					Name: ALIAS_NAME,
					User_Alias: BASE_USER_ID,
					Command: "old_command",
					Invocation: "old",
					Arguments: null,
					Parent: null,
					Channel: null
				}
			};

			const result = await baseCommand.execute(baseContext, "edit", ALIAS_NAME, "definitely_not_a_command");
			expectCommandResultFailure(result, "command", "does not exist");
		});

		it("2 args: should fail when alias is linked", async () => {
			const [cmd] = EXISTING_COMMANDS;
			const aliasName = "linked";
			existingAliasMap[BASE_USER_ID] = {
				[aliasName]: {
					Name: aliasName,
					User_Alias: BASE_USER_ID,
					Command: null,
					Invocation: null,
					Arguments: null,
					Parent: 123,
					Channel: null
				}
			};

			const result = await baseCommand.execute(baseContext, "edit", aliasName, cmd);
			expectCommandResultFailure(result, "cannot edit", "links", "aliases");
		});

		it("2 args: should succeed and update command without arguments", async () => {
			const ALIAS_NAME = "baz";
			const [cmd] = EXISTING_COMMANDS;

			existingAliasMap[BASE_USER_ID] = {
				[ALIAS_NAME]: {
					Name: ALIAS_NAME,
					User_Alias: BASE_USER_ID,
					Command: "oldcmd",
					Invocation: "old",
					Arguments: "x y",
					Parent: null,
					Channel: null
				}
			};

			const result = await baseCommand.execute(baseContext, "edit", ALIAS_NAME, cmd);
			expectCommandResultSuccess(result, "alias", ALIAS_NAME, "successfully", "edited");

			const row = world.rows.pop();
			assert.ok(row, "Expected a Row to be saved");
			assert.ok(row.updated, "Expected Row to be updated");
			assert.strictEqual(row.values.Command, cmd);
			assert.strictEqual(row.values.Invocation, cmd);
			assert.strictEqual(row.values.Arguments, null);

			assert.strictEqual(world.rows.length, 0);
		});

		it("2 args: should succeed and update command with arguments", async () => {
			const ALIAS_NAME = "baz";
			const [cmd] = EXISTING_COMMANDS;

			existingAliasMap[BASE_USER_ID] = {
				[ALIAS_NAME]: {
					Name: ALIAS_NAME,
					User_Alias: BASE_USER_ID,
					Command: "oldcmd",
					Invocation: "old",
					Arguments: "x y",
					Parent: null,
					Channel: null
				}
			};

			const ALIAS_ARGUMENTS = ["1", "2", "3"];
			const result = await baseCommand.execute(baseContext, "edit", ALIAS_NAME, cmd, ...ALIAS_ARGUMENTS);
			expectCommandResultSuccess(result, "alias", ALIAS_NAME, "successfully", "edited");

			const row = world.rows.pop();
			assert.ok(row, "Expected a Row to be saved");
			assert.ok(row.updated, "Expected Row to be updated");
			assert.strictEqual(row.values.Command, cmd);
			assert.strictEqual(row.values.Invocation, cmd);
			assert.strictEqual(row.values.Arguments, JSON.stringify(ALIAS_ARGUMENTS));

			assert.strictEqual(world.rows.length, 0);
		});

		// $alias edit (alias) (command) -> OK, check object
	});

	describe("inspect", () => {
		it("0 args: should fail, no alias/user provided", async () => {
			const result = await baseCommand.execute(baseContext, "inspect");
			expectCommandResultFailure(result, "didn't provide", "alias", "user name");
		});

		it("1 arg: should fail when alias is not owned", async () => {
			const result = await baseCommand.execute(baseContext, "inspect", "foo");
			expectCommandResultFailure(result, "don't have", "foo");
		});

		it("2 args: should fail when provided user does not exist", async () => {
			const result = await baseCommand.execute(baseContext, "inspect", "bob", "foo");
			expectCommandResultFailure(result, "Provided user does not exist!");
		});

		it("2 args: should fail when user exists but does not own the alias", async () => {
			const TARGET_USER = "bob";
			const TARGET_USER_ID = 222;

			world.allowUser(TARGET_USER);
			world.setUserId(TARGET_USER, TARGET_USER_ID);

			const result = await baseCommand.execute(baseContext, "inspect", TARGET_USER, "foo");
			expectCommandResultFailure(result, "don't have", "foo");
		});

		it("2 args: should succeed when alias has no description", async () => {
			const TARGET_USER = "bob";
			const TARGET_USER_ID = 223;
			const ALIAS_NAME = "foo";

			existingAliasMap[TARGET_USER_ID] = {
				[ALIAS_NAME]: {
					Name: ALIAS_NAME,
					User_Alias: TARGET_USER_ID,
					Description: null
				}
			};

			world.allowUser(TARGET_USER);
			world.setUserId(TARGET_USER, TARGET_USER_ID);

			const result = await baseCommand.execute(baseContext, "inspect", TARGET_USER, ALIAS_NAME);
			expectCommandResultSuccess(result, "Alias", ALIAS_NAME, "has no description");
		});

		it("2 args: should succeed and print the description", async () => {
			const TARGET_USER = "bob";
			const TARGET_USER_ID = 224;
			const ALIAS_NAME = "bar";
			const DESC = "A helpful description.";

			existingAliasMap[TARGET_USER_ID] = {
				[ALIAS_NAME]: {
					Name: ALIAS_NAME,
					User_Alias: TARGET_USER_ID,
					Description: DESC
				}
			};

			world.allowUser(TARGET_USER);
			world.setUserId(TARGET_USER, TARGET_USER_ID);

			const result = await baseCommand.execute(baseContext, "inspect", TARGET_USER, ALIAS_NAME);
			expectCommandResultSuccess(result, ALIAS_NAME, DESC);
		});
	});

	describe("$alias link", () => {
		// $alias link -> error
		// $alias link (string) -> error
		// $alias link (string) (already owned alias name) -> error
		// $alias link (nonexistent user) (string) -> error
		// $alias link (username) (unowned alias name) -> error
		// $alias link (username) (link-restricted alias name) -> error
		// $alias link (username) (already linked alias name) -> OK, but mention the link is a reference
		// $alias link (username) (dangling linked alias name) -> error, original is deleted
		// $alias link (username) (dangling linked alias name) -> error, original is deleted
		// $alias link (username) (illegal alias name) -> error
		// $alias link (username) (alias name) -> OK, check object
		// $alias link (username) (alias name) (custom name) -> OK, check object + custom name mentioned
		// $alias link (username) (alias name) (custom name) -> OK, check object + custom name mentioned
		// $alias linkplace (string) (already owned alias name) -> OK
		// $alias linkplace (string) (already owned alias name) (custom name) -> OK
	});

	describe("$alias publish", () => {
		// $alias publish [not in a channel] -> error
		// $alias publish [user not privileged] -> error
		// $alias publish -> error
		// $alias publish (unowned alias) -> error
		// $alias publish (string) (nonexistent user) -> error
		// $alias publish (unowned alias) (username) -> error
		// $alias publish (owned alias) [channel does not have alias published] -> OK
		// $alias publish (owned alias, illegal name) -> error
		// $alias publish (owned alias) [channel already has this alias published] -> error
		// $alias publish (owned alias) (username) [channel already has this alias published] -> error
		// $alias publish (owned alias) [channel already has same name alias published] -> error
		// $alias publish (owned alias) (username) [channel already has same name alias published] -> error
		// $alias publish (owned alias) [channel does not have alias published] -> OK, check object
		// $alias publish (owned alias) (username) [channel does not have alias published] -> OK, check object
		// $alias unpublish (owned alias) [channel does not have alias published] -> error
		// $alias unpublish (owned alias) [channel has alias published] -> OK
		// $alias unpublish (owned alias) (username) [channel does not have alias published] -> error
		// $alias unpublish (owned alias) (username) [channel has alias published] -> OK
	});

	describe("$alias published", () => {
		it.skip("published");
		// $alias published [not in a channel] -> error
		// $alias published [in a channel] -> OK
	});

	describe("$alias remove", () => {
		it.skip("remove");
		// $alias remove -> error
		// $alias remove (unowned alias) -> error
		// $alias remove (owned alias) -> OK
		// $alias remove (owned alias) [published in channels] -> OK, check that publishes get removed + message
	});

	describe("$alias rename", () => {
		it.skip("rename");
		// $alias rename -> error
		// $alias rename (string) -> error
		// $alias rename (string) (illegal new name) -> error
		// $alias rename (unowned alias) (new name) -> error
	});

	describe("$alias restrict", () => {
		it.skip("restrict");
		// $alias restrict -> error
		// $alias restrict (string) -> error
		// $alias restrict (string) (not link/copy) -> error
		// $alias restrict (unowned alias) (link/copy) -> error
		// $alias restrict (owned unrestricted alias) (link/copy) -> OK

		// $alias restrict (owned link-restricted alias) (copy) -> OK
		// $alias restrict (owned copy-restricted alias) (link) -> OK
		// $alias restrict (owned link-restricted alias) (link) -> error, already restricted
		// $alias restrict (owned copy-restricted alias) (copy) -> error, already restricted
		// $alias restrict (owned both-restricted alias) (link) -> error, already restricted
		// $alias restrict (owned both-restricted alias) (copy) -> error, already restricted

		// $alias unrestrict (owned link-restricted alias) (copy) -> error, not restricted
		// $alias unrestrict (owned link-restricted alias) (link) -> OK
		// $alias unrestrict (owned copy-restricted alias) (link) -> error, not restricted
		// $alias unrestrict (owned copy-restricted alias) (copy) -> OK
		// $alias unrestrict (owned both-restricted alias) (link) -> OK
		// $alias unrestrict (owned both-restricted alias) (copy) -> OK
	});

	describe("$alias run", () => {
		it.skip("run");
		// $alias run -> error
		// $alias try -> error
		// $alias try (nonexistent user) -> error
		// $alias run (unowned alias) -> error
		// $alias try (username) (unowned alias) -> error
		// $alias run (linked alias, target deleted) -> error
		// $alias try (username) (linked alias, target deleted) -> error
		// $alias run (alias containing a legacy command) -> error
		// $alias try (username) (alias containing a legacy command) -> error
		// $alias run (alias containing pipe-only command) -> error
		// $alias try (username) (alias containing pipe-only command) -> error
		// $alias run (alias with too many nested calls) -> error
		// $alias run (alias with disallowed command combination) -> error

		// Maybe: $alias run (valid alias) -> OK
	});

	describe("$alias transfer", () => {
		it.skip("transfer");
		// $alias transfer [not a Twitch user] -> error
		// $alias transfer -> error
		// $alias transfer (nonexistent old username) -> error
		// $alias transfer (old username) [Twitch ID mismatch] -> error
		// $alias transfer (old username) [conflicting new/old aliases] -> error
		// $alias transfer (old username) -> OK, check aliases changing user
	});
});
