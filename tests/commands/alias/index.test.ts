import { it, describe, beforeEach, mock, afterEach } from "node:test";
import assert from "node:assert/strict";

import type { SupiDate } from "supi-core";
import { type User, permissions as userPermissions } from "../../../classes/user.js";
import { Command, type Context, type ContextData } from "../../../classes/command.js";
import type { Channel } from "../../../classes/channel.js";

import {
	createTestPlatform,
	createTestUser,
	createTestChannel,
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
	let channelAliasMap: Record<string, Record<string, Partial<AliasData>> | undefined> = {};
	const commandMap = new Map<string, Command>();

	const world = new TestWorld();

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
			getChannelAlias: (aliasName: string, channelId: number) => {
				const channelAliases = channelAliasMap[channelId];
				if (!channelAliases) {
					return null;
				}

				return channelAliases[aliasName] ?? null;
			},
			getParentAlias: (alias: AliasData) => {
				if (alias.Parent === null) {
					return null;
				}

				for (const userAliases of Object.values(existingAliasMap)) {
					if (!userAliases) {
						continue;
					}

					for (const potentialParent of Object.values(userAliases)) {
						if (alias === potentialParent) {
							continue;
						}
						if (alias.Parent === potentialParent.ID) {
							return potentialParent;
						}
					}
				}

				return null;
			},
			parseCommandName: (name: string) => {
				const mapCommand = commandMap.get(name);
				if (mapCommand) {
					return mapCommand;
				}

				return (EXISTING_COMMANDS.includes(name)) ? createTestCommand({ Name: name }) : null;
			}
		}
	});

	const aliasCommandDefinition = (await import("../../../commands/alias/index.js")).default;

	const BASE_USERNAME = "test_user";
	const BASE_USER_ID = 1337;

	let baseCommand = new Command(aliasCommandDefinition);
	const baseUser = createTestUser({ Name: BASE_USERNAME, ID: BASE_USER_ID });
	const basePlatform = createTestPlatform();
	const baseContext = Command.createFakeContext(baseCommand, {
		platformSpecificData: null,
		user: baseUser,
		platform: basePlatform
	});

	const cloneContext = (context: Context, extra: Partial<ContextData> = {}): Context => (
		// eslint-disable-next-line @typescript-eslint/no-misused-spread
		Command.createFakeContext(context.command, { ...context, ...extra })
	);

	beforeEach(() => {
		baseCommand = new Command(aliasCommandDefinition);
		world.reset();
		world.install();
		existingAliasMap = {};
		channelAliasMap = {};
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
					Restrictions: ["copy"] as ("link" | "copy")[]
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

	describe("link/linkplace", () => {
		describe("link", () => {
			it("0 args: should fail, no parameters provided", async () => {
				const result = await baseCommand.execute(baseContext, "link");
				expectCommandResultFailure(result, "didn't provide", "user", "alias");
			});

			it("1 arg: should fail, missing alias name", async () => {
				const result = await baseCommand.execute(baseContext, "link", "someone");
				expectCommandResultFailure(result, "didn't provide", "alias", "name");
			});

			it("2 args: should fail when you already own an alias with that name", async () => {
				const REMOTE_USER = "alice";
				const REMOTE_USER_ID = 501;
				const ALIAS = "foo";

				world.allowUser(REMOTE_USER);
				world.setUserId(REMOTE_USER, REMOTE_USER_ID);

				// You (BASE_USER_ID) already own "foo"
				existingAliasMap[BASE_USER_ID] = {
					[ALIAS]: { Name: ALIAS, User_Alias: BASE_USER_ID, Command: "echo", Parent: null }
				};
				// Remote user also has "foo" (the one we want to link)
				existingAliasMap[REMOTE_USER_ID] = {
					[ALIAS]: { ID: 9001, Name: ALIAS, User_Alias: REMOTE_USER_ID, Command: "echo", Parent: null }
				};

				const result = await baseCommand.execute(baseContext, "link", REMOTE_USER, ALIAS);
				expectCommandResultFailure(result, "Cannot", "link", "already have", "with this name");
			});

			it("2 args: should fail when provided user does not exist", async () => {
				const result = await baseCommand.execute(baseContext, "link", "nobody", "foo");
				expectCommandResultFailure(result, "Provided user does not exist!");
			});

			it("2 args: should fail when target user does not have the alias", async () => {
				const REMOTE_USER = "bob";
				const REMOTE_USER_ID = 502;
				const ALIAS_NAME = "missing";

				world.allowUser(REMOTE_USER);
				world.setUserId(REMOTE_USER, REMOTE_USER_ID);

				existingAliasMap[REMOTE_USER_ID] = {};

				const result = await baseCommand.execute(baseContext, "link", REMOTE_USER, ALIAS_NAME);
				expectCommandResultFailure(result, "user", "does not have", ALIAS_NAME);
			});

			it("2 args: should fail when the target alias is link-restricted", async () => {
				const REMOTE_USER = "carol";
				const REMOTE_USER_ID = 503;
				const ALIAS = "locked";

				world.allowUser(REMOTE_USER);
				world.setUserId(REMOTE_USER, REMOTE_USER_ID);

				existingAliasMap[REMOTE_USER_ID] = {
					[ALIAS]: {
						ID: 9100,
						Name: ALIAS,
						User_Alias:
						REMOTE_USER_ID,
						Command: "doit",
						Parent: null,
						Restrictions: ["link"] as ("link" | "copy")[]
					}
				};

				const result = await baseCommand.execute(baseContext, "link", REMOTE_USER, ALIAS);
				expectCommandResultFailure(result, "cannot", "link", "prevented new links"); // tweak tokens if needed
			});

			it("2 args: should succeed when linking an alias that is itself a link and mention the fact", async () => {
				const REMOTE_USER = "dave";
				const REMOTE_USER_ID = 504;
				const ORIGINAL_ID = 9200;
				const ORIGINAL_ALIAS = "origin";
				const LINKED_ID = 9201;
				const LINKED_ALIAS = "ref";

				world.allowUser(REMOTE_USER);
				world.setUserId(REMOTE_USER, REMOTE_USER_ID);

				existingAliasMap[REMOTE_USER_ID] = {
					// alias "ref" is itself a link to "origin"
					[LINKED_ALIAS]: {
						ID: LINKED_ID,
						Name: LINKED_ALIAS,
						User_Alias: REMOTE_USER_ID,
						Command: null,
						Invocation: null,
						Arguments: null,
						Channel: null,
						Parent: ORIGINAL_ID
					},
					// The original exists (not dangling)
					[ORIGINAL_ALIAS]: {
						ID: ORIGINAL_ID,
						Name: ORIGINAL_ALIAS,
						User_Alias: REMOTE_USER_ID,
						Command: "run",
						Invocation: ORIGINAL_ALIAS,
						Arguments: "a b",
						Channel: null,
						Parent: null
					}
				};

				const result = await baseCommand.execute(baseContext, "link", REMOTE_USER, LINKED_ALIAS);
				expectCommandResultSuccess(result, "Successfully linked", "tried to create a link", "already linked", "alias", LINKED_ALIAS, REMOTE_USER);

				const row = world.rows.pop();
				assert.ok(row, "Expected a Row to be saved");
				// New link should point to the same ORIGINAL_ID (not to dave's linked alias id)
				assert.strictEqual(row.values.Parent, ORIGINAL_ID);
				assert.notStrictEqual(row.values.Parent, LINKED_ID);
				assert.strictEqual(row.values.Name, LINKED_ALIAS);
				assert.strictEqual(row.values.User_Alias, BASE_USER_ID);

				assert.strictEqual(world.rows.length, 0);
			});

			it("2 args: should fail when target alias is a link to a deleted original", async () => {
				const REMOTE_USER = "erin";
				const REMOTE_USER_ID = 505;
				const ALIAS = "danglingA";

				world.allowUser(REMOTE_USER);
				world.setUserId(REMOTE_USER, REMOTE_USER_ID);

				// A link whose Parent does not exist in storage
				existingAliasMap[REMOTE_USER_ID] = {
					[ALIAS]: {
						ID: 9301,
						Name: ALIAS,
						User_Alias: REMOTE_USER_ID,
						Command: null,
						Channel: null,
						Parent: 999999 // missing
					}
				};

				const result = await baseCommand.execute(baseContext, "link", REMOTE_USER, ALIAS);
				expectCommandResultFailure(result, "cannot link", "the original", "links to", "deleted");
			});

			it("2 args: should fail when provided alias name is illegal", async () => {
				const REMOTE_USER = "gail";
				const REMOTE_USER_ID = 507;
				const ILLEGAL_NAME = "$$$";

				world.allowUser(REMOTE_USER);
				world.setUserId(REMOTE_USER, REMOTE_USER_ID);

				existingAliasMap[REMOTE_USER_ID] = {
					[ILLEGAL_NAME]: {
						ID: 9301,
						Name: ILLEGAL_NAME,
						User_Alias: REMOTE_USER_ID,
						Command: "run",
						Channel: null,
						Parent: null
					}
				};

				const result = await baseCommand.execute(baseContext, "link", REMOTE_USER, ILLEGAL_NAME);
				expectCommandResultFailure(result, "alias", "name", "not valid");
			});

			it("2 args: should fail when attempting to link a zombie alias", async () => {
				const ALIAS_NAME = "foo";
				const REMOTE_USER = "gail2";
				const REMOTE_USER_ID = 508;

				world.allowUser(REMOTE_USER);
				world.setUserId(REMOTE_USER, REMOTE_USER_ID);

				// Zombie alias - doesn't have Command = should be a link; but also doesn't have Parent anymore = zombie
				existingAliasMap[REMOTE_USER_ID] = {
					[ALIAS_NAME]: {
						ID: 9301,
						Name: ALIAS_NAME,
						User_Alias: REMOTE_USER_ID,
						Command: null,
						Channel: null,
						Parent: null
					}
				};

				const result = await baseCommand.execute(baseContext, "link", REMOTE_USER, ALIAS_NAME);
				expectCommandResultFailure(result, "original alias", "been removed");
			});

			it("2 args: should succeed and create a link with the same name", async () => {
				const REMOTE_USER = "helen";
				const REMOTE_USER_ID = 508;
				const ALIAS = "util";
				const ORIG_ID = 9400;

				world.allowUser(REMOTE_USER);
				world.setUserId(REMOTE_USER, REMOTE_USER_ID);

				existingAliasMap[REMOTE_USER_ID] = {
					[ALIAS]: {
						ID: ORIG_ID,
						Name: ALIAS,
						User_Alias: REMOTE_USER_ID,
						Command: "echo",
						Invocation: "util",
						Arguments: "x y",
						Parent: null,
						Channel: null
					}
				};

				const result = await baseCommand.execute(baseContext, "link", REMOTE_USER, ALIAS);
				expectCommandResultSuccess(result, "Successfully", "linked", "When", "original changes", "so will yours");

				const row = world.rows.pop();
				assert.ok(row, "Expected a Row to be saved");
				assert.strictEqual(row.values.Name, ALIAS);
				assert.strictEqual(row.values.Parent, ORIG_ID);
				assert.strictEqual(row.values.Command, null);
				assert.strictEqual(row.values.Invocation, null);
				assert.strictEqual(row.values.Arguments, null);

				assert.strictEqual(world.rows.length, 0);
			});

			it("3 args: should succeed and create a link with a custom name", async () => {
				const REMOTE_USER = "irene";
				const REMOTE_USER_ID = 509;
				const ALIAS = "build";
				const CUSTOM_NAME = "buildx";
				const ORIG_ID = 9500;

				world.allowUser(REMOTE_USER);
				world.setUserId(REMOTE_USER, REMOTE_USER_ID);

				existingAliasMap[REMOTE_USER_ID] = {
					[ALIAS]: {
						ID: ORIG_ID,
						Name: ALIAS,
						User_Alias: REMOTE_USER_ID,
						Command: "run",
						Invocation: "build",
						Arguments: "a b c",
						Parent: null,
						Channel: null
					}
				};

				const result = await baseCommand.execute(baseContext, "link", REMOTE_USER, ALIAS, CUSTOM_NAME);
				expectCommandResultSuccess(result, "linked", "custom name", CUSTOM_NAME);

				const row = world.rows.pop();
				assert.ok(row, "Expected a Row to be saved");
				assert.strictEqual(row.values.Name, CUSTOM_NAME);
				assert.strictEqual(row.values.Parent, ORIG_ID);
				assert.strictEqual(row.values.Command, null);
				assert.strictEqual(row.values.Invocation, null);
				assert.strictEqual(row.values.Arguments, null);

				assert.strictEqual(world.rows.length, 0);
			});
		});

		describe("linkplace", () => {
			it("2 args: should succeed when linking an alias with a conflicting name", async () => {
				const ALIAS_NAME = "home";
				const REMOTE_USER = "jane";
				const REMOTE_USER_ID = 510;

				world.allowUser(REMOTE_USER);
				world.setUserId(REMOTE_USER, REMOTE_USER_ID);

				const REMOTE_USER_ALIAS_ID = 9701;
				const EXISTING_ALIAS_ID = 9700;

				// Remote user owns "home"
				existingAliasMap[REMOTE_USER_ID] = {
					[ALIAS_NAME]: {
						ID: REMOTE_USER_ALIAS_ID,
						Name: ALIAS_NAME,
						User_Alias: REMOTE_USER_ID,
						Command: "ALIAS_NAME",
						Invocation: ALIAS_NAME,
						Arguments: "",
						Parent: null
					}
				};
				// Base user also already owns "home" - will be overwritten
				existingAliasMap[BASE_USER_ID] = {
					[ALIAS_NAME]: {
						ID: EXISTING_ALIAS_ID,
						Name: ALIAS_NAME,
						User_Alias: BASE_USER_ID,
						Command: "go",
						Invocation: ALIAS_NAME,
						Arguments: "",
						Parent: null
					}
				};

				const result = await baseCommand.execute(baseContext, "linkplace", REMOTE_USER, ALIAS_NAME);
				expectCommandResultSuccess(result, "Successfully", "linked and replaced");

				const row = world.rows.pop();
				assert.ok(row, "Expected a Row to be saved");
				assert.strictEqual(row.values.Parent, REMOTE_USER_ALIAS_ID);
				assert.strictEqual(row.values.Name, ALIAS_NAME);
				assert.strictEqual(row.values.Command, null);
				assert.strictEqual(row.values.Invocation, null);
				assert.strictEqual(row.values.Arguments, null);

				assert.strictEqual(world.rows.length, 0);
			});

			it("3 args: should succeed when linking a local alias by name with a custom name", async () => {
				const ALIAS_NAME = "home";
				const CUSTOM_NAME = "foobar";
				const REMOTE_USER = "kate";
				const REMOTE_USER_ID = 510;

				world.allowUser(REMOTE_USER);
				world.setUserId(REMOTE_USER, REMOTE_USER_ID);

				const REMOTE_USER_ALIAS_ID = 9701;
				const EXISTING_ALIAS_ID = 9700;

				// Remote user owns "home"
				existingAliasMap[REMOTE_USER_ID] = {
					[ALIAS_NAME]: {
						ID: REMOTE_USER_ALIAS_ID,
						Name: ALIAS_NAME,
						User_Alias: REMOTE_USER_ID,
						Command: "ALIAS_NAME",
						Invocation: ALIAS_NAME,
						Arguments: "",
						Parent: null
					}
				};
				// Base user already owns "foobar" - will be overwritten by custom name
				existingAliasMap[BASE_USER_ID] = {
					[CUSTOM_NAME]: {
						ID: EXISTING_ALIAS_ID,
						Name: CUSTOM_NAME,
						User_Alias: BASE_USER_ID,
						Command: "go",
						Invocation: CUSTOM_NAME,
						Arguments: "",
						Parent: null
					}
				};

				const result = await baseCommand.execute(baseContext, "linkplace", REMOTE_USER, ALIAS_NAME, CUSTOM_NAME);
				expectCommandResultSuccess(result, "Successfully", "linked and replaced", "custom name", CUSTOM_NAME);

				const row = world.rows.pop();
				assert.ok(row, "Expected a Row to be saved");
				assert.strictEqual(row.values.Parent, REMOTE_USER_ALIAS_ID);
				assert.strictEqual(row.values.Name, CUSTOM_NAME);
				assert.strictEqual(row.values.Command, null);
				assert.strictEqual(row.values.Invocation, null);
				assert.strictEqual(row.values.Arguments, null);

				assert.strictEqual(world.rows.length, 0);
			});
		});
	});

	describe("publish/unpublish", () => {
		const createPublishContext = (channel: number | null, isPrivileged: boolean) => {
			const context = Command.createFakeContext(baseCommand, {
				platformSpecificData: null,
				user: baseUser,
				platform: basePlatform,
				channel: (channel === null) ? null : createTestChannel(channel, basePlatform)
			});

			context.getUserPermissions = (() => Promise.resolve((isPrivileged)
				? { flag: userPermissions.channelOwner }
				: { flag: userPermissions.regular }
			)) as unknown as Context["getUserPermissions"];

			return context;
		};

		describe("publish", () => {
			it("0 args (not in a channel): should fail", async () => {
				const privateMessageContext = createPublishContext(null, false);
				const result = await baseCommand.execute(privateMessageContext, "publish");
				expectCommandResultFailure(result, "This subcommand can only be used in the channel you want the alias to be global in!");
			});

			it("0 args (in channel but not privileged): should fail", async () => {
				const context = createPublishContext(1, false);
				const result = await baseCommand.execute(context, "publish");
				expectCommandResultFailure(result, "Only the owner and ambassadors of this channel can use this subcommand!");
			});

			it("0 args: should fail, no alias name provided", async () => {
				const context = createPublishContext(2, true);
				const result = await baseCommand.execute(context, "publish");
				expectCommandResultFailure(result, "No alias name provided!");
			});

			it("1 arg: should fail when current user doesn't own the alias", async () => {
				const CHANNEL_ID = 2;
				const context = createPublishContext(CHANNEL_ID, true);

				const result = await baseCommand.execute(context, "publish", "does_not_exist");
				expectCommandResultFailure(result, "That user does not have an alias with that name!");
			});

			it("2 args: should fail when target user doesn't exist", async () => {
				const CHANNEL_ID = 3;
				const context = createPublishContext(CHANNEL_ID, true);

				const result = await baseCommand.execute(context, "publish", "does_not_exist", "user_does_not_exist");
				expectCommandResultFailure(result, "Provided user does not exist!");
			});

			it("2 args: should fail when user target user doesn't own alias", async () => {
				const CHANNEL_ID = 4;
				const context = createPublishContext(CHANNEL_ID, true);

				const TARGET_USER_NAME = "foo";
				world.allowUser(TARGET_USER_NAME);

				const result = await baseCommand.execute(context, "publish", "does_not_exist", TARGET_USER_NAME);
				expectCommandResultFailure(result, "That user does not have an alias with that name!");
			});

			it("2 args: should succeed when current user owns the alias", async () => {
				const CHANNEL_ID = 5;
				const context = createPublishContext(CHANNEL_ID, true);

				const ALIAS_NAME = "foo";
				const ALIAS_ID = 1;
				existingAliasMap[BASE_USER_ID] = {
					[ALIAS_NAME]: {
						ID: ALIAS_ID,
						Name: ALIAS_NAME,
						User_Alias: BASE_USER_ID,
						Command: "bar",
						Invocation: ALIAS_NAME,
						Arguments: "",
						Parent: null
					}
				};

				const result = await baseCommand.execute(context, "publish", ALIAS_NAME);
				expectCommandResultSuccess(result, "Successfully published", ALIAS_NAME, "use", "directly");

				const row = world.rows.pop();
				assert.ok(row, "Expected a Row to be saved");
				assert.strictEqual(row.values.Name, ALIAS_NAME);
				assert.strictEqual(row.values.Channel, CHANNEL_ID);
				assert.strictEqual(row.values.Parent, ALIAS_ID);

				// Not explicitly set by `$alias publish`, so make sure they are falsy, "not there"
				assert.ok(!row.values.User_Alias);
				assert.ok(!row.values.Invocation);
				assert.ok(!row.values.Command);

				assert.strictEqual(world.rows.length, 0);
			});

			it("2 args: should fail when current user owns an illegally named alias", async () => {
				const CHANNEL_ID = 6;
				const context = createPublishContext(CHANNEL_ID, true);

				const ILLEGAL_ALIAS_NAME = "$$";
				const ALIAS_ID = 1;
				existingAliasMap[BASE_USER_ID] = {
					[ILLEGAL_ALIAS_NAME]: {
						ID: ALIAS_ID,
						Name: ILLEGAL_ALIAS_NAME,
						User_Alias: BASE_USER_ID,
						Command: "bar",
						Invocation: ILLEGAL_ALIAS_NAME,
						Arguments: "",
						Parent: null
					}
				};

				const result = await baseCommand.execute(context, "publish", ILLEGAL_ALIAS_NAME);
				expectCommandResultFailure(result, "Published alias name", "not valid");
			});

			it("2 args: should fail when same name alias is already published (by current user)", async () => {
				const CHANNEL_ID = 7;
				const context = createPublishContext(CHANNEL_ID, true);

				const ALIAS_NAME = "foo";
				const EXISTING_ALIAS_ID = 1;

				const CHANNEL_ALIAS_ID = 2;
				const CHANNEL_ALIAS = {
					ID: CHANNEL_ALIAS_ID,
					Name: ALIAS_NAME,
					Command: null,
					Invocation: null,
					Parent: EXISTING_ALIAS_ID
				};
				channelAliasMap[CHANNEL_ID] = {
					[ALIAS_NAME]: CHANNEL_ALIAS
				};

				// Set up some previously existing alias, bound to EXISTING_USER_ID
				const EXISTING_USER_NAME = "foobar";
				const EXISTING_USER_ID = 2345;
				const EXISTING_ALIAS = {
					ID: EXISTING_ALIAS_ID,
					Name: ALIAS_NAME,
					User_Alias: EXISTING_USER_ID,
					Command: "bar",
					Invocation: ALIAS_NAME,
					Arguments: "",
					Parent: null
				};

				// Set up current user to have the same alias (identical, for simplicity)
				existingAliasMap[BASE_USER_ID] = {
					[ALIAS_NAME]: EXISTING_ALIAS
				};

				world.allowUser(EXISTING_USER_NAME);
				world.setUserId(EXISTING_USER_NAME, EXISTING_USER_ID);

				world.setRow("data", "Custom_Command_Alias", EXISTING_ALIAS_ID, EXISTING_ALIAS);
				world.setRow("data", "Custom_Command_Alias", CHANNEL_ALIAS_ID, CHANNEL_ALIAS);

				const result = await baseCommand.execute(context, "publish", ALIAS_NAME);
				expectCommandResultFailure(result, "The alias", ALIAS_NAME, `by ${EXISTING_USER_NAME}`, "version made by you", "unpublish");
			});

			it("3 args: should fail when same name alias is already published (by target user)", async () => {
				const CHANNEL_ID = 8;
				const context = createPublishContext(CHANNEL_ID, true);

				const ALIAS_NAME = "bar";
				const EXISTING_ALIAS_ID = 11;
				const ANOTHER_ALIAS_ID = 12;

				const CHANNEL_ALIAS_ID = 22;
				const CHANNEL_ALIAS = {
					ID: CHANNEL_ALIAS_ID,
					Name: ALIAS_NAME,
					Command: null,
					Invocation: null,
					Parent: EXISTING_ALIAS_ID
				};
				channelAliasMap[CHANNEL_ID] = {
					[ALIAS_NAME]: CHANNEL_ALIAS
				};

				const EXISTING_USER_NAME = "foobar1";
				const EXISTING_USER_ID = 3456;
				world.allowUser(EXISTING_USER_NAME);
				world.setUserId(EXISTING_USER_NAME, EXISTING_USER_ID);

				// Bind the existing alias to a user
				const EXISTING_ALIAS = {
					ID: EXISTING_ALIAS_ID,
					Name: ALIAS_NAME,
					User_Alias: EXISTING_USER_ID,
					Command: "bar",
					Invocation: ALIAS_NAME,
					Arguments: "",
					Parent: null
				};
				existingAliasMap[EXISTING_USER_ID] = {
					[ALIAS_NAME]: EXISTING_ALIAS
				};

				const ANOTHER_USER_NAME = "foobar2";
				const ANOTHER_USER_ID = 4567;
				world.allowUser(ANOTHER_USER_NAME);
				world.setUserId(ANOTHER_USER_NAME, ANOTHER_USER_ID);

				// Bind another alias to another user (identical to the above one, for simplicity)
				const ANOTHER_ALIAS = {
					ID: ANOTHER_ALIAS_ID,
					Name: ALIAS_NAME,
					User_Alias: ANOTHER_USER_ID,
					Command: "bar",
					Invocation: ALIAS_NAME,
					Arguments: "",
					Parent: null
				};
				existingAliasMap[ANOTHER_USER_ID] = {
					[ALIAS_NAME]: ANOTHER_ALIAS
				};

				world.setRow("data", "Custom_Command_Alias", EXISTING_ALIAS_ID, EXISTING_ALIAS);
				world.setRow("data", "Custom_Command_Alias", ANOTHER_USER_ID, ANOTHER_ALIAS);
				world.setRow("data", "Custom_Command_Alias", CHANNEL_ALIAS_ID, CHANNEL_ALIAS);

				const result = await baseCommand.execute(context, "publish", ALIAS_NAME, ANOTHER_USER_NAME);
				expectCommandResultFailure(result, "The alias", ALIAS_NAME, `by ${EXISTING_USER_NAME}`, `version made by ${ANOTHER_USER_NAME}`, "unpublish");
			});

			it("3 args: should succeed when target user owns the alias", async () => {
				const CHANNEL_ID = 8;
				const context = createPublishContext(CHANNEL_ID, true);

				const EXISTING_ALIAS_NAME = "bar1";
				const EXISTING_ALIAS_ID = 11;

				const EXISTING_USER_NAME = "foobar2";
				const EXISTING_USER_ID = 4567;
				world.allowUser(EXISTING_USER_NAME);
				world.setUserId(EXISTING_USER_NAME, EXISTING_USER_ID);

				const EXISTING_ALIAS = {
					ID: EXISTING_ALIAS_ID,
					Name: EXISTING_ALIAS_NAME,
					User_Alias: EXISTING_USER_ID,
					Command: "bar",
					Invocation: EXISTING_ALIAS_NAME,
					Arguments: "",
					Parent: null
				};
				existingAliasMap[EXISTING_USER_ID] = {
					[EXISTING_ALIAS_NAME]: EXISTING_ALIAS
				};

				world.setRow("data", "Custom_Command_Alias", EXISTING_ALIAS_ID, EXISTING_ALIAS);

				const result = await baseCommand.execute(context, "publish", EXISTING_ALIAS_NAME, EXISTING_USER_NAME);
				expectCommandResultSuccess(result, "Successfully published alias", EXISTING_ALIAS_NAME);

				const row = world.rows.pop();
				assert.ok(row, "Expected a Row to be saved");
				assert.strictEqual(row.values.Name, EXISTING_ALIAS_NAME);
				assert.strictEqual(row.values.Channel, CHANNEL_ID);
				assert.strictEqual(row.values.Parent, EXISTING_ALIAS_ID);

				// Not explicitly set by `$alias publish`, so make sure they are falsy, "not there"
				assert.ok(!row.values.User_Alias);
				assert.ok(!row.values.Invocation);
				assert.ok(!row.values.Command);

				assert.strictEqual(world.rows.length, 0);
			});
		});

		describe("unpublish", () => {
			it("2 args: should fail when channel does not have the alias published", async () => {
				const CHANNEL_ID = 10;
				const context = createPublishContext(CHANNEL_ID, true);
				const ALIAS_NAME = "foo";

				const result = await baseCommand.execute(context, "unpublish", ALIAS_NAME);
				expectCommandResultFailure(result, "That alias", "not been published");
			});

			it("2 args: should succeed when channel has published alias", async () => {
				const CHANNEL_ID = 11;
				const context = createPublishContext(CHANNEL_ID, true);
				const ALIAS_NAME = "foo";

				const EXISTING_ALIAS_ID = 1337;
				const CHANNEL_ALIAS_ID = 2;
				const CHANNEL_ALIAS = {
					ID: CHANNEL_ALIAS_ID,
					Name: ALIAS_NAME,
					Command: null,
					Invocation: null,
					Parent: EXISTING_ALIAS_ID
				};
				channelAliasMap[CHANNEL_ID] = {
					[ALIAS_NAME]: CHANNEL_ALIAS
				};

				world.setRow("data", "Custom_Command_Alias", CHANNEL_ALIAS_ID, CHANNEL_ALIAS);

				const result = await baseCommand.execute(context, "unpublish", ALIAS_NAME);
				expectCommandResultSuccess(result, "Successfully", "unpublished", ALIAS_NAME);

				const row = world.rows.pop();
				assert.ok(row, "Expected a Row to be created");
				assert.ok(row.deleted);
				assert.strictEqual(row.values.ID, CHANNEL_ALIAS_ID);

				assert.strictEqual(world.rows.length, 0);
			});
		});
	});

	describe("published", () => {
		const CHANNEL_ID = 200;
		const createContext = (isPrivate: boolean = false) => Command.createFakeContext(baseCommand, {
			platformSpecificData: null,
			user: baseUser,
			platform: basePlatform,
			channel: (isPrivate) ? null : createTestChannel(CHANNEL_ID, basePlatform)
		});

		it("0 args: should fail when in private messages", async () => {
			const context = createContext(true);
			const result = await baseCommand.execute(context, "published");
			expectCommandResultFailure(result, "no", "aliases", "private messages");
		});

		it("0 args: should succeed when in channel", async () => {
			const context = createContext(false);
			const result = await baseCommand.execute(context, "published");
			expectCommandResultSuccess(result, "List of published aliases", "https://", String(CHANNEL_ID));
		});
	});

	describe("remove", () => {
		it("0 args: should fail, missing alias name", async () => {
			const result = await baseCommand.execute(baseContext, "remove");
			expectCommandResultFailure(result, "No alias name provided");
		});

		it("1 arg: should fail when user does not own the alias", async () => {
			const ALIAS_NAME = "foo";
			const result = await baseCommand.execute(baseContext, "remove", ALIAS_NAME);
			expectCommandResultFailure(result, "don't have", ALIAS_NAME);
		});

		it("1 arg: should remove user alias", async () => {
			const ALIAS_NAME = "foo";
			const ALIAS_ID = 1001;

			const OWNED_ALIAS = {
				ID: ALIAS_ID,
				Name: ALIAS_NAME,
				User_Alias: BASE_USER_ID,
				Command: "bar",
				Invocation: ALIAS_NAME,
				Arguments: "",
				Parent: null
			};
			existingAliasMap[BASE_USER_ID] = { [ALIAS_NAME]: OWNED_ALIAS };
			world.setRow("data", "Custom_Command_Alias", ALIAS_ID, OWNED_ALIAS);
			world.queueRsData([]); // Return an empty array for a list of published aliases

			const result = await baseCommand.execute(baseContext, "remove", ALIAS_NAME);
			expectCommandResultSuccess(result, "successfully", "removed", ALIAS_NAME);

			const row = world.rows.pop();
			assert.ok(row, "Expected a Row to be processed");
			assert.ok(row.deleted);
			assert.strictEqual(row.values.ID, ALIAS_ID);

			assert.strictEqual(world.rows.length, 0);
		});

		it("1 arg: should remove published aliases and mention this", async () => {
			const ALIAS_NAME = "foo";
			const ALIAS_ID = 2002;

			const OWNED_ALIAS = {
				ID: ALIAS_ID,
				Name: ALIAS_NAME,
				User_Alias: BASE_USER_ID,
				Command: "bar",
				Invocation: ALIAS_NAME,
				Arguments: "",
				Parent: null
			};
			existingAliasMap[BASE_USER_ID] = { [ALIAS_NAME]: OWNED_ALIAS };
			world.setRow("data", "Custom_Command_Alias", ALIAS_ID, OWNED_ALIAS);

			const CHANNEL_ID = 30;
			const CHANNEL_ALIAS_ID1 = 3001;
			const CHANNEL_ALIAS_ID2 = 3002;
			const CHANNEL_ALIAS1 = { ID: CHANNEL_ALIAS_ID1, Name: ALIAS_NAME, Command: null, Invocation: null, Parent: ALIAS_ID, Channel: CHANNEL_ID };
			const CHANNEL_ALIAS2 = { ID: CHANNEL_ALIAS_ID2, Name: ALIAS_NAME, Command: null, Invocation: null, Parent: ALIAS_ID, Channel: CHANNEL_ID };
			world.setRow("data", "Custom_Command_Alias", CHANNEL_ALIAS_ID1, CHANNEL_ALIAS1);
			world.setRow("data", "Custom_Command_Alias", CHANNEL_ALIAS_ID2, CHANNEL_ALIAS2);
			world.queueRsData([CHANNEL_ALIAS_ID1, CHANNEL_ALIAS_ID2]);

			const result = await baseCommand.execute(baseContext, "remove", ALIAS_NAME);
			expectCommandResultSuccess(result, "successfully", "removed", ALIAS_NAME, "also published in", "2 channels");

			const rd = world.recordDeleters.pop();
			assert.ok(rd);
			assert.strictEqual(rd.schema, "data");
			assert.strictEqual(rd.table, "Custom_Command_Alias");

			assert.strictEqual(rd.conditions.length, 3);
			const [idCond, channelCond, parentCond] = rd.conditions;
			assert.deepStrictEqual(idCond.args[0], [CHANNEL_ALIAS_ID1, CHANNEL_ALIAS_ID2]);
			assert.strictEqual(parentCond.args[0], ALIAS_ID);

			const row = world.rows.pop();
			assert.ok(row);
			assert.ok(row.deleted);
			assert.strictEqual(world.rows.length, 0);
			assert.strictEqual(world.recordDeleters.length, 0);
		});
	});

	describe("rename", () => {
		it("0 args: should fail, both names not provided", async () => {
			const result = await baseCommand.execute(baseContext, "rename");
			expectCommandResultFailure(result, "must provide", "current alias name", "new one");
		});

		it("1 arg: should fail, missing new alias name", async () => {
			const result = await baseCommand.execute(baseContext, "rename", "foo");
			expectCommandResultFailure(result, "must provide", "current alias name", "new one");
		});

		it("2 args: should fail when the new alias name is illegal", async () => {
			const result = await baseCommand.execute(baseContext, "rename", "foo", "$$$");
			expectCommandResultFailure(result, "new alias name", "not valid");
		});

		it("2 args: should fail when you don't own the alias", async () => {
			const OLD_ALIAS = "foo";
			const NEW_ALIAS = "bar";
			const result = await baseCommand.execute(baseContext, "rename", OLD_ALIAS, NEW_ALIAS);
			expectCommandResultFailure(result, "don't have", OLD_ALIAS);
		});

		it("2 args: should fail when you already have the new alias", async () => {
			const OLD_ALIAS = "foo";
			const NEW_ALIAS = "bar";

			// Seed an owned alias and also a conflicting alias with the new name
			existingAliasMap[BASE_USER_ID] = {
				[OLD_ALIAS]: { ID: 1, Name: OLD_ALIAS, User_Alias: BASE_USER_ID, Command: "cmd", Invocation: OLD_ALIAS, Arguments: "" },
				[NEW_ALIAS]: { ID: 2, Name: NEW_ALIAS, User_Alias: BASE_USER_ID, Command: "cmd2", Invocation: NEW_ALIAS, Arguments: "" }
			};

			const result = await baseCommand.execute(baseContext, "rename", OLD_ALIAS, NEW_ALIAS);
			expectCommandResultFailure(result, "already have", NEW_ALIAS);
		});

		it("2 args: should succeed and rename the alias", async () => {
			const OLD_ALIAS = "foo";
			const NEW_ALIAS = "bar";
			const ALIAS_ID = 123;
			const ORIGINAL_ALIAS = {
				ID: ALIAS_ID,
				Name: OLD_ALIAS,
				User_Alias: BASE_USER_ID,
				Command: "echo",
				Invocation: OLD_ALIAS,
				Arguments: "x y",
				Parent: null,
				Channel: null
			};

			existingAliasMap[BASE_USER_ID] = {
				[OLD_ALIAS]: { ...ORIGINAL_ALIAS }
			};

			world.setRow("data", "Custom_Command_Alias", ALIAS_ID, { ...ORIGINAL_ALIAS });

			const result = await baseCommand.execute(baseContext, "rename", OLD_ALIAS, NEW_ALIAS);
			expectCommandResultSuccess(result, "successfully", "renamed", OLD_ALIAS, NEW_ALIAS);

			const row = world.rows.pop();
			assert.ok(row, "Expected a Row to be saved");
			assert.ok(row.updated, "Expected Row to be updated");
			assert.strictEqual(row.values.Name, NEW_ALIAS);
			assert.strictEqual(row.values.Command, ORIGINAL_ALIAS.Command);
			assert.strictEqual(row.values.Invocation, ORIGINAL_ALIAS.Invocation);
			assert.strictEqual(row.values.Arguments, ORIGINAL_ALIAS.Arguments);
			assert.strictEqual(row.values.User_Alias, ORIGINAL_ALIAS.User_Alias);
			assert.strictEqual(row.values.ID, ORIGINAL_ALIAS.ID);

			assert.strictEqual(world.rows.length, 0);
		});
	});

	describe("restrict/unrestrict", () => {
		describe("common", () => {
			it("0 args: should fail, missing name and type", async () => {
				const result = await baseCommand.execute(baseContext, "restrict");
				expectCommandResultFailure(result, "didn't provide", "name", "restriction type");
			});

			it("1 arg: should fail, missing type", async () => {
				const result = await baseCommand.execute(baseContext, "restrict", "foo");
				expectCommandResultFailure(result, "didn't provide", "name", "restriction type");
			});

			it("2 args: should fail on invalid restriction type", async () => {
				const result = await baseCommand.execute(baseContext, "restrict", "foo", "invalid");
				expectCommandResultFailure(result, "didn't provide", "restriction type");
			});

			it("2 args: should fail when alias not owned", async () => {
				const result = await baseCommand.execute(baseContext, "restrict", "foo", "link");
				expectCommandResultFailure(result, "don't have", "foo");
			});
		});

		describe("restrict", () => {
			it("should add link restriction to unrestricted alias", async () => {
				const name = "foo";
				const id = 201;
				const aliasData = {
					ID: id,
					Name: name,
					User_Alias: BASE_USER_ID,
					Command: "cmd",
					Invocation: name,
					Arguments: "",
					Parent: null,
					Channel: null,
					Restrictions: null
				};
				existingAliasMap[BASE_USER_ID] = { [name]: { ...aliasData } };
				world.setRow("data", "Custom_Command_Alias", id, { ...aliasData });

				const result = await baseCommand.execute(baseContext, "restrict", name, "link");
				expectCommandResultSuccess(result, "successfully", "restricted", "linked");

				const row = world.rows.pop();
				assert.ok(row);
				assert.ok(row.updated);
				assert.deepStrictEqual(row.values.Restrictions, ["link"]);
				assert.strictEqual(world.rows.length, 0);
			});

			it("should add copy restriction to link-restricted alias", async () => {
				const name = "foo";
				const id = 202;

				const aliasData = {
					ID: id,
					Name: name,
					User_Alias: BASE_USER_ID,
					Command: "cmd",
					Invocation: name,
					Arguments: "",
					Parent: null,
					Channel: null,
					Restrictions: ["link"] as ("link" | "copy")[]
				};
				existingAliasMap[BASE_USER_ID] = { [name]: { ...aliasData } };
				world.setRow("data", "Custom_Command_Alias", id, { ...aliasData });

				const result = await baseCommand.execute(baseContext, "restrict", name, "copy");
				expectCommandResultSuccess(result, "successfully", "restricted", "copied");

				const row = world.rows.pop();
				assert.ok(row);
				assert.ok(row.updated);
				assert.deepStrictEqual(row.values.Restrictions, ["link", "copy"]);
				assert.strictEqual(world.rows.length, 0);
			});

			it("should add link restriction to copy-restricted alias", async () => {
				const name = "foo";
				const id = 203;
				const aliasData = {
					ID: id,
					Name: name,
					User_Alias: BASE_USER_ID,
					Command: "cmd",
					Invocation: name,
					Arguments: "",
					Parent: null,
					Channel: null,
					Restrictions: ["copy"] as ("link" | "copy")[]
				};
				existingAliasMap[BASE_USER_ID] = { [name]: { ...aliasData } };
				world.setRow("data", "Custom_Command_Alias", id, { ...aliasData });

				const result = await baseCommand.execute(baseContext, "restrict", name, "link");
				expectCommandResultSuccess(result, "successfully", "restricted", "linked");

				const row = world.rows.pop();
				assert.ok(row);
				assert.ok(row.updated);
				assert.deepStrictEqual(row.values.Restrictions, ["copy", "link"]);
				assert.strictEqual(world.rows.length, 0);
			});

			it("should fail when alias already restricted (copy)", async () => {
				const name = "foo";
				const id = 204;
				const aliasData = {
					ID: id,
					Name: name,
					User_Alias: BASE_USER_ID,
					Command: "cmd",
					Invocation: name,
					Arguments: "",
					Parent: null,
					Channel: null,
					Restrictions: ["copy"] as ("link" | "copy")[]
				};
				existingAliasMap[BASE_USER_ID] = { [name]: { ...aliasData } };
				world.setRow("data", "Custom_Command_Alias", id, { ...aliasData });

				const result = await baseCommand.execute(baseContext, "restrict", name, "copy");
				expectCommandResultFailure(result, "already", "restricted", "copied");
			});

			it("should fail when alias already restricted (link)", async () => {
				const name = "foo";
				const id = 205;
				const aliasData = {
					ID: id,
					Name: name,
					User_Alias: BASE_USER_ID,
					Command: "cmd",
					Invocation: name,
					Arguments: "",
					Parent: null,
					Channel: null,
					Restrictions: ["link"] as ("link" | "copy")[]
				};
				existingAliasMap[BASE_USER_ID] = { [name]: { ...aliasData } };
				world.setRow("data", "Custom_Command_Alias", id, { ...aliasData });
				const result = await baseCommand.execute(baseContext, "restrict", name, "link");
				expectCommandResultFailure(result, "already", "restricted", "linked");
			});

			it("should fail when alias already fully restricted", async () => {
				const name = "foo";
				const id = 206;
				const aliasData = {
					ID: id,
					Name: name,
					User_Alias: BASE_USER_ID,
					Command: "cmd",
					Invocation: name,
					Arguments: "",
					Parent: null,
					Channel: null,
					Restrictions: ["link", "copy"] as ("link" | "copy")[]
				};
				existingAliasMap[BASE_USER_ID] = { [name]: { ...aliasData } };
				world.setRow("data", "Custom_Command_Alias", id, { ...aliasData });

				const firstContext = cloneContext(baseContext);
				const result1 = await baseCommand.execute(firstContext, "restrict", name, "link");
				expectCommandResultFailure(result1, "already", "restricted", "linked");

				const secondContext = cloneContext(baseContext);
				const result2 = await baseCommand.execute(secondContext, "restrict", name, "copy");
				expectCommandResultFailure(result2, "already", "restricted", "copied");
			});
		});

		describe("unrestrict", () => {
			it("should fail when unrestricting copy on link-restricted alias", async () => {
				const name = "foo";
				const id = 207;
				const aliasData = {
					ID: id,
					Name: name,
					User_Alias: BASE_USER_ID,
					Command: "cmd",
					Invocation: name,
					Arguments: "",
					Parent: null,
					Channel: null,
					Restrictions: ["link"] as ("link" | "copy")[]
				};
				existingAliasMap[BASE_USER_ID] = { [name]: { ...aliasData } };
				world.setRow("data", "Custom_Command_Alias", id, { ...aliasData });

				const result = await baseCommand.execute(baseContext, "unrestrict", name, "copy");
				expectCommandResultFailure(result, "already", "unrestricted", "copied");
			});

			it("should succeed when unrestricting link on link-restricted alias", async () => {
				const name = "foo";
				const id = 208;
				const aliasData = {
					ID: id,
					Name: name,
					User_Alias: BASE_USER_ID,
					Command: "cmd",
					Invocation: name,
					Arguments: "",
					Parent: null,
					Channel: null,
					Restrictions: ["link"] as ("link" | "copy")[]
				};
				existingAliasMap[BASE_USER_ID] = { [name]: { ...aliasData } };
				world.setRow("data", "Custom_Command_Alias", id, { ...aliasData });

				const result = await baseCommand.execute(baseContext, "unrestrict", name, "link");
				expectCommandResultSuccess(result, "successfully", "unrestrict", "linked");

				const row = world.rows.pop();
				assert.ok(row);
				assert.ok(row.updated);
				assert.strictEqual(row.values.Restrictions, null);
				assert.strictEqual(world.rows.length, 0);
			});

			it("should fail when unrestricting link on copy-restricted alias", async () => {
				const name = "foo";
				const id = 209;
				const aliasData = {
					ID: id,
					Name: name,
					User_Alias: BASE_USER_ID,
					Command: "cmd",
					Invocation: name,
					Arguments: "",
					Parent: null,
					Channel: null,
					Restrictions: ["copy"] as ("link" | "copy")[]
				};
				existingAliasMap[BASE_USER_ID] = { [name]: { ...aliasData } };
				world.setRow("data", "Custom_Command_Alias", id, { ...aliasData });

				const result = await baseCommand.execute(baseContext, "unrestrict", name, "link");
				expectCommandResultFailure(result, "already", "unrestricted", "linked");
			});

			it("should succeed when unrestricting copy on copy-restricted alias", async () => {
				const name = "foo";
				const id = 210;
				const aliasData = {
					ID: id,
					Name: name,
					User_Alias: BASE_USER_ID,
					Command: "cmd",
					Invocation: name,
					Arguments: "",
					Parent: null,
					Channel: null,
					Restrictions: ["copy"] as ("link" | "copy")[]
				};
				existingAliasMap[BASE_USER_ID] = { [name]: { ...aliasData } };
				world.setRow("data", "Custom_Command_Alias", id, { ...aliasData });

				const result = await baseCommand.execute(baseContext, "unrestrict", name, "copy");
				expectCommandResultSuccess(result, "successfully", "unrestrict", "copied");

				const row = world.rows.pop();
				assert.ok(row);
				assert.ok(row.updated);
				assert.strictEqual(row.values.Restrictions, null);
				assert.strictEqual(world.rows.length, 0);
			});

			it("should succeed when unrestricting link on both-restricted alias", async () => {
				const name = "foo";
				const id = 211;
				const aliasData = {
					ID: id,
					Name: name,
					User_Alias: BASE_USER_ID,
					Command: "cmd",
					Invocation: name,
					Arguments: "",
					Parent: null,
					Channel: null,
					Restrictions: ["copy", "link"] as ("link" | "copy")[]
				};
				existingAliasMap[BASE_USER_ID] = { [name]: { ...aliasData } };
				world.setRow("data", "Custom_Command_Alias", id, { ...aliasData });

				const result = await baseCommand.execute(baseContext, "unrestrict", name, "link");
				expectCommandResultSuccess(result, "successfully", "unrestrict", "linked");

				const row = world.rows.pop();
				assert.ok(row);
				assert.ok(row.updated);
				assert.deepStrictEqual(row.values.Restrictions, ["copy"]);
				assert.strictEqual(world.rows.length, 0);
			});

			it("should succeed when unrestricting copy on both-restricted alias", async () => {
				const name = "foo";
				const id = 212;
				const aliasData = {
					ID: id,
					Name: name,
					User_Alias: BASE_USER_ID,
					Command: "cmd",
					Invocation: name,
					Arguments: "",
					Parent: null,
					Channel: null,
					Restrictions: ["copy", "link"] as ("link" | "copy")[]
				};
				existingAliasMap[BASE_USER_ID] = { [name]: { ...aliasData } };
				world.setRow("data", "Custom_Command_Alias", id, { ...aliasData });

				const result = await baseCommand.execute(baseContext, "unrestrict", name, "copy");
				expectCommandResultSuccess(result, "successfully", "unrestrict", "copied");

				const row = world.rows.pop();
				assert.ok(row);
				assert.ok(row.updated);
				assert.deepStrictEqual(row.values.Restrictions, ["link"]);
				assert.strictEqual(world.rows.length, 0);
			});
		});
	});

	describe("run/try", () => {
		it("0 args: should fail, no input provided", async () => {
			const result = await baseCommand.execute(baseContext, "run");
			expectCommandResultFailure(result, "No input provided");
		});

		describe("run", () => {
			it("2 args: should fail when alias not found", async () => {
				world.queueRsData([]);
				const ALIAS_NAME = "foo";

				const result = await baseCommand.execute(baseContext, "run", ALIAS_NAME);
				expectCommandResultFailure(result, "don't have", ALIAS_NAME);
			});

			it("2 args: should fail with deleted original", async () => {
				const ALIAS_NAME = "zombie";
				const aliasData = {
					ID: 500,
					Name: ALIAS_NAME,
					User_Alias: BASE_USER_ID,
					Command: null,
					Invocation: null,
					Arguments: "",
					Parent: null,
					Channel: null
				};
				world.queueRsData([aliasData]);

				const result = await baseCommand.execute(baseContext, "run", ALIAS_NAME);
				expectCommandResultFailure(result, "original has been deleted");
			});

			it("2 args: should fail with deleted original", async () => {
				const REMOTE_USER = "charlie";
				const REMOTE_ID = 402;
				world.allowUser(REMOTE_USER);
				world.setUserId(REMOTE_USER, REMOTE_ID);

				const ALIAS_NAME = "zombie2";
				const aliasData = {
					ID: 501,
					Name: ALIAS_NAME,
					User_Alias: REMOTE_ID,
					Command: null,
					Invocation: null,
					Arguments: "",
					Parent: null,
					Channel: null
				};
				world.queueRsData([aliasData]);

				const result = await baseCommand.execute(baseContext, "try", REMOTE_USER, ALIAS_NAME);
				expectCommandResultFailure(result, "original has been deleted");
			});

			it("2 args: should fail when running a legacy command", async () => {
				const ALIAS_NAME = "legacy";
				const aliasData = {
					ID: 502,
					Name: ALIAS_NAME,
					User_Alias: BASE_USER_ID,
					Command: "anything",
					Invocation: "OLD_CMD",
					Arguments: "",
					Parent: null,
					Channel: null
				};
				world.queueRsData([aliasData]);

				const result = await baseCommand.execute(baseContext, "run", ALIAS_NAME);
				expectCommandResultFailure(result, "archived, retired, or removed");
			});

			it("2 args: should fail when running alias with illegal arguments", async () => {
				const ALIAS_NAME = "fine";
				const aliasData = {
					ID: 503,
					Name: ALIAS_NAME,
					User_Alias: BASE_USER_ID,
					Command: "foo",
					Invocation: "foo",
					Arguments: `["\${2..3+}"]`,
					Parent: null,
					Channel: null
				};
				world.queueRsData([aliasData]);

				const result = await baseCommand.execute(baseContext, "run", ALIAS_NAME);
				expectCommandResultFailure(result, "Cannot combine", "argument symbols");
			});

			it("2 args: should fail when pipe-illegal command in pipe", async () => {
				const context = cloneContext(baseContext, {
					append: { pipe: true }
				});

				const COMMAND_NAME = "foo";
				commandMap.set(COMMAND_NAME, createTestCommand({
					Name: COMMAND_NAME,
					Flags: []
				}));

				const ALIAS_NAME = "fine";
				const aliasData = {
					ID: 504,
					Name: ALIAS_NAME,
					User_Alias: BASE_USER_ID,
					Command: COMMAND_NAME,
					Invocation: COMMAND_NAME,
					Arguments: null,
					Parent: null,
					Channel: null
				};
				world.queueRsData([aliasData]);

				const result = await baseCommand.execute(context, "run", ALIAS_NAME);
				expectCommandResultFailure(result, "Cannot", "use", "inside of a pipe");
			});

			it("2 args: fails on alias that nests aliases too much", async () => {
				const COMMAND_NAME = "foo";
				const ALIAS_NAME = "bar";
				const context = cloneContext(baseContext, {
					append: { aliasCount: realAliasUtils.NESTED_ALIAS_LIMIT + 1 }
				});

				const aliasData = {
					ID: 503,
					Name: ALIAS_NAME,
					User_Alias: BASE_USER_ID,
					Command: COMMAND_NAME,
					Invocation: COMMAND_NAME,
					Arguments: null,
					Parent: null,
					Channel: null
				};
				world.queueRsData([aliasData]);

				const fauxCommand = createTestCommand({ Name: COMMAND_NAME });
				commandMap.set(COMMAND_NAME, fauxCommand);

				const result = await baseCommand.execute(context, "run", ALIAS_NAME);
				expectCommandResultFailure(result, "cannot continue", "causes more than", "alias calls", "reduce the complexity");
			});

			describe("actually running mocked commands", () => {
				beforeEach(() => {
					sb.Command = Command;
				});

				it("2 args: succeeds on properly made alias", async () => {
					const COMMAND_NAME = "foo";
					const ALIAS_NAME = "bar";
					const SAMPLE_REPLY = "foobarbaz";
					const COMMAND_SUCCESS = true;

					const fauxCommand = createTestCommand({
						Name: COMMAND_NAME,
						Params: [],
						Code: () => ({ reply: SAMPLE_REPLY, success: COMMAND_SUCCESS })
					});

					commandMap.set(COMMAND_NAME, fauxCommand);
					sb.Command.data.set(COMMAND_NAME, fauxCommand);
					world.failOnEmptyRecordset = false;

					const aliasData = {
						ID: 503,
						Name: ALIAS_NAME,
						User_Alias: BASE_USER_ID,
						Command: COMMAND_NAME,
						Invocation: COMMAND_NAME,
						Arguments: null,
						Parent: null,
						Channel: null
					};
					world.queueRsData([aliasData]);

					const result = await baseCommand.execute(baseContext, "run", ALIAS_NAME);
					expectCommandResultSuccess(result, SAMPLE_REPLY);
				});

				it("2 args: succeeds on running a linked alias", async () => {
					const FINAL_COMMAND_NAME = "ping";
					const FAUX_COMMAND_REPLY = "FOO_BAR_BAZ";
					const fauxCommand = createTestCommand({
						Name: FINAL_COMMAND_NAME,
						Params: [],
						Code: () => ({ reply: FAUX_COMMAND_REPLY, success: true })
					});

					commandMap.set(FINAL_COMMAND_NAME, fauxCommand);
					sb.Command.data.set(FINAL_COMMAND_NAME, fauxCommand);
					commandMap.set("alias", baseCommand);
					sb.Command.data.set("alias", baseCommand);
					world.failOnEmptyRecordset = false;

					const ANOTHER_USER_NAME = "other_user";
					const ANOTHER_USER_ID = 4567;
					world.allowUser(ANOTHER_USER_NAME);
					world.setUserId(ANOTHER_USER_NAME, ANOTHER_USER_ID);

					const CURRENT_USER_ALIAS_ID_1 = 699;
					const CURRENT_USER_ALIAS_ID_2 = 600;
					const ANOTHER_USER_ALIAS_ID_1 = 610;
					const ANOTHER_USER_ALIAS_ID_2 = 619;

					const currentUserAlias1 = {
						ID: CURRENT_USER_ALIAS_ID_1,
						Name: "start",
						User_Alias: BASE_USER_ID,
						Command: "alias",
						Invocation: "alias",
						Arguments: JSON.stringify(["run", "foo"]),
						Channel: null,
						Parent: null
					};
					const currentUserAlias2 = {
						ID: CURRENT_USER_ALIAS_ID_2,
						Name: "foo",
						User_Alias: BASE_USER_ID,
						Command: null,
						Invocation: null,
						Channel: null,
						Parent: ANOTHER_USER_ALIAS_ID_1
					};
					const otherUserAlias1 = {
						ID: ANOTHER_USER_ALIAS_ID_1,
						Name: "bar",
						User_Alias: ANOTHER_USER_ID,
						Command: "alias",
						Invocation: "alias",
						Arguments: JSON.stringify(["run", "baz"]),
						Channel: null,
						Parent: null
					};
					const otherUserAlias2 = {
						ID: ANOTHER_USER_ALIAS_ID_2,
						Name: "bar",
						User_Alias: ANOTHER_USER_ID,
						Command: "ping",
						Invocation: "ping",
						Arguments: "",
						Channel: null,
						Parent: null
					};

					world.setRows("data", "Custom_Command_Alias", {
						[CURRENT_USER_ALIAS_ID_1]: currentUserAlias1,
						[CURRENT_USER_ALIAS_ID_2]: currentUserAlias2,
						[ANOTHER_USER_ALIAS_ID_1]: otherUserAlias1,
						[ANOTHER_USER_ALIAS_ID_2]: otherUserAlias2
					});
					existingAliasMap[BASE_USER_ID] = {
						start: currentUserAlias1,
						foo: currentUserAlias2
					};
					existingAliasMap[ANOTHER_USER_ID] = {
						bar: otherUserAlias1,
						baz: otherUserAlias2
					};

					world.queueRsData([currentUserAlias1]);
					world.queueRsData([]);
					world.queueRsData([]);
					world.queueRsData([otherUserAlias1]);
					world.queueRsData([]);
					world.queueRsData([]);
					world.queueRsData([otherUserAlias2]);

					const result = await baseCommand.execute(baseContext, "run", "start");
					expectCommandResultSuccess(result, FAUX_COMMAND_REPLY);
				});
			});
		});

		describe("try", () => {
			it("1 arg: should fail on no alias provided", async () => {
				const result = await baseCommand.execute(baseContext, "try", "alice");
				expectCommandResultFailure(result, "didn't provide", "alias to try");
			});

			it("2 args: should fail with nonexistent user", async () => {
				const result = await baseCommand.execute(baseContext, "try", "alice", "foo");
				expectCommandResultFailure(result, "Provided user does not exist");
			});

			it("2 args: should fail when alias not found for user", async () => {
				const REMOTE_USER = "bob";
				const REMOTE_ID = 401;
				world.allowUser(REMOTE_USER);
				world.setUserId(REMOTE_USER, REMOTE_ID);
				world.queueRsData([]);

				const ALIAS_NAME = "foo";
				const result = await baseCommand.execute(baseContext, "try", REMOTE_USER, ALIAS_NAME);
				expectCommandResultFailure(result, "don't have", ALIAS_NAME);
			});

			// try a nested alias - dependencies must work
		});
	});

	describe("transfer", () => {
		const discordContext = cloneContext(baseContext, {
			user: createTestUser({ Name: "DISCORD_USER", Discord_ID: "123" })
		});
		const twitchContext = cloneContext(baseContext, {
			user: createTestUser({ Name: "TWITCH_USER", Twitch_ID: "234" })
		});

		it("0 args: should fail, not a Twitch user", async () => {
			const result = await baseCommand.execute(discordContext, "transfer");
			expectCommandResultFailure(result, "only works", "Twitch users");
		});

		it("0 args: should fail, no input", async () => {
			const result = await baseCommand.execute(twitchContext, "transfer");
			expectCommandResultFailure(result, "must provide", "previous username");
		});

		it("1 arg: should fail on invalid username", async () => {
			const result = await baseCommand.execute(twitchContext, "transfer", "DOES_NOT_EXIST");
			expectCommandResultFailure(result, "not seen", "that user", "Twitch");
		});

		it("1 arg: should fail on different twitch ID username", async () => {
			const TARGET_USER = "foobar";
			const targetDifferentUser = createTestUser({ Name: TARGET_USER, Twitch_ID: "999" });
			world.prepareUser(targetDifferentUser);

			const result = await baseCommand.execute(twitchContext, "transfer", TARGET_USER);
			expectCommandResultFailure(result, "Your", "Twitch ID", "not the same");
		});

		it.skip("transfer");
		// $alias transfer (old username) [conflicting new/old aliases] -> error
		// $alias transfer (old username) -> OK, check aliases changing user
	});
});
