import { it, describe, beforeEach, mock, before } from "node:test";
import assert from "node:assert/strict";

import { SupiDate } from "supi-core";
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
		expectCommandResultSuccess(result, "https://", "Must include link to details");
	});

	it("fails on invalid subcommand provided", async () => {
		const result = await baseCommand.execute(baseContext, "DOES_NOT_EXIST");
		expectCommandResultFailure(result);
	});

	describe("$alias check", () => {
		it ("should post a link when nothing is provided", async () => {
			const result = await baseCommand.execute(baseContext, "check");
			expectCommandResultSuccess(result, BASE_USERNAME);
		});

		it ("should fail when neither user nor alias exists", async () => {
			world.queueRsData([]);

			const result = await baseCommand.execute(baseContext, "check", "NO_USER");
			expectCommandResultFailure(result);
		});

		it ("should suceed when provided user exists", async () => {
			const TARGET_USER = "bob";
			world.allowUser(TARGET_USER);
			world.queueRsData([]); // No aliases for current user
			world.queueRsData([{}]); // Some alias for target user

			const result = await baseCommand.execute(baseContext, "check", TARGET_USER);
			expectCommandResultSuccess(result, TARGET_USER);
		});

		it ("should fail when provided user exists but has no aliases", async () => {
			const TARGET_USER = "bob";
			world.allowUser(TARGET_USER);
			world.queueRsData([]); // No aliases for current user
			world.queueRsData([]); // No aliases for target user

			const result = await baseCommand.execute(baseContext, "check", TARGET_USER);
			expectCommandResultFailure(result);
		});

		it ("should succeed when base user owns the provided alias", async () => {
			const ALIAS_NAME = "Foo";
			world.queueRsData([ALIAS_NAME]);
			existingAliasMap[baseUser.ID] = { Foo: {} };

			const result = await baseCommand.execute(baseContext, "check", ALIAS_NAME);
			expectCommandResultSuccess(result, ALIAS_NAME);
		});

		it ("should succeed when provided user owns the provided alias", async () => {
			const ALIAS_NAME = "Foo";
			world.queueRsData([]);
			world.queueRsData([ALIAS_NAME]);
			existingAliasMap[baseUser.ID] = { Foo: {} };

			const result = await baseCommand.execute(baseContext, "check", ALIAS_NAME);
			// todo continue here
			// expectCommandResultSuccess(result, ALIAS_NAME);
		});
	});

	/*
	describe("$alias add", async () => {
		it("should fail on no alias name provided", async () => {
			const result1 = await baseCommand.execute(baseContext, "add");
			assert.strictEqual(result1.success, false, "Should fail on no alias name provided");
		});

		const result2 = await baseCommand.execute(baseContext, "add", "foo");
		assert.strictEqual(result2.success, false, "Should fail on no alias content provided");

		const result3 = await baseCommand.execute(baseContext, "add", "foo", "NO_COMMAND");
		assert.strictEqual(result3.success, false, "Should fail on invalid command name provided");

		const aliasName = "foo";
		const commandName = EXISTING_COMMANDS[0];
		const result4 = await baseCommand.execute(baseContext, "add", aliasName, commandName);
		assert.notStrictEqual(result4.success, false, "Should pass when creating an alias");
		assert.strictEqual(result4.reply?.includes("created"), true, "Should say \"created\" in response");

		const row4 = rows.pop();
		assert.ok(row4);
		assert.deepEqual(row4.values.Command, commandName);
		assert.strictEqual(row4.values.Name, aliasName);
		assert.strictEqual(row4.values.Arguments, null);
		assert.strictEqual(row4.values.User_Alias, BASE_USER_ID);

		existingAliasMap = {
			[BASE_USER_ID]: {
				[row4.values.Name]: row4.values
			}
		};

		const result5 = await baseCommand.execute(baseContext, "add", aliasName, commandName);
		assert.strictEqual(result5.success, false, "Should fail when trying to add an existing alias");

		const testArgs = ["foo", "bar", "baz"];
		const result6 = await baseCommand.execute(baseContext, "upsert", aliasName, commandName, ...testArgs);
		assert.notStrictEqual(result6.success, false, "Should overwrite existing alias");
		assert.strictEqual(result6.reply?.includes("replaced"), true, "Should say \"replaced\" in response");

		const row6 = rows.pop();
		assert.ok(row6);
		assert.deepStrictEqual(row6.values.Arguments, JSON.stringify(testArgs));

		const result7 = await baseCommand.execute(baseContext, "add", "@@@", commandName, ...testArgs);
		assert.strictEqual(result7.success, false, "Should reject non-conforming alias names (illegal character)");

		const result8 = await baseCommand.execute(baseContext, "add", "F", commandName, ...testArgs);
		assert.strictEqual(result8.success, false, "Should reject non-conforming alias names (too short)");

		const result9 = await baseCommand.execute(baseContext, "add", "F".repeat(31), commandName, ...testArgs);
		assert.strictEqual(result9.success, false, "Should reject non-conforming alias names (too long)");
	});

	 */
	/*

	it("check: properly links aliases for specific users", async () => {
		const result1 = await baseCommand.execute(baseContext, "list");
		assert.notStrictEqual(result1.success, false);
		assert.strictEqual(result1.reply?.includes("your aliases"), true);

		recordsetData = [];
		const someUsername = "SOME_USER";
		const result2 = await baseCommand.execute(baseContext, "check", someUsername);
		assert.strictEqual(result2.reply?.includes(someUsername), true);

		// $alias check (neither exist)
		// $alias check (username)
		// $alias check (alias)
		// $alias check (both username and alias exist)
		//
	});
*/
	it("copy: properly copies aliases", async () => {
		// $alias copy -> error
		// $alias copy (username) -> error
		// $alias copy (username) (illegal alias name) -> error
		// $alias copy (nonexistent username) (alias name) -> error
		// $alias copy (username) (alias name that username does not own) -> error
		// $alias copy (username) (alias name that username owns but is linked) -> error
		// $alias copy (username) (alias name, but is copy-restricted) -> error
		// $alias copy (username) (alias name, but name already exists) -> error
		// $alias copyplace (username) (alias name, but name already exists) -> OK, check object
		// $alias copy (username) (alias name) -> OK, check object
	});

	it("describe: properly adds descriptions", async () => {
		// $alias describe -> error
		// $alias describe (alias not owned) -> error
		// $alias describe (alias) (description too long) -> error
		// $alias describe (alias) (none/empty) -> OK, resets description
		// $alias describe (alias) (text) -> OK, sets description
	});

	it("duplicate: properly creates identical copies", async () => {
		// $alias duplicate -> error
		// $alias duplicate (old alias) -> error
		// $alias duplicate (old alias) (new illegal alias name) -> error
		// $alias duplicate (unowned old alias) (new alias) -> error
		// $alias duplicate (linked alias) (new alias) -> error
		// $alias duplicate (old alias) (already existing new alias) -> error
		// $alias duplicate (old alias) (new alias) -> OK, check object
	});

	it("edit: properly edits existing aliases", async () => {
		// $alias edit -> error
		// $alias edit (alias) -> error
		// $alias edit (unowned alias) -> error
		// $alias edit (alias) (nonexistent command) -> error
		// $alias edit (linked alias) (command) -> error
		// $alias edit (alias) (command) -> OK, check object
	});

	it("inspect: properly edits existing aliases", async () => {
		// $alias inspect -> error
		// $alias inspect (unowned alias) -> error
		// $alias inspect (nonexistent user) (alias) -> error
		// $alias inspect (user) (unowned alias) -> error
		// $alias inspect (user) (alias without description) -> OK
		// $alias inspect (user) (alias with description) -> OK
	});

	it("link: properly links aliases together", async () => {
		// $alias link -> error
		// $alias link (string) -> error
		// $alias link (string) (already owned alias name) -> error
		// $alias link (nonexistent user) (string) -> error
		// $alias link (username) (unowned alias name) -> error
		// $alias link (username) (link-restricted alias name) -> error
		// $alias link (username) (linked alias name) -> OK, mention the nested link
		// $alias link (username) (dangling linked alias name) -> error, original is deleted
		// $alias link (username) (dangling linked alias name) -> error, original is deleted
		// $alias link (username) (illegal alias name) -> error
		// $alias link (username) (alias name) -> OK, check object
		// $alias link (username) (alias name) (custom name) -> OK, check object + custom name mentioned
		// $alias link (username) (alias name) (custom name) -> OK, check object + custom name mentioned
		// $alias linkplace (string) (already owned alias name) -> OK
		// $alias linkplace (string) (already owned alias name) (custom name) -> OK
	});

	it("publish: properly (un)publishes existing aliases", async () => {
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

	it("published: properly lists published aliases", async () => {
		it.skip("published");
		// $alias published [not in a channel] -> error
		// $alias published [in a channel] -> OK
	});

	it("remove: properly deletes existing aliases", async () => {
		it.skip("remove");
		// $alias remove -> error
		// $alias remove (unowned alias) -> error
		// $alias remove (owned alias) -> OK
		// $alias remove (owned alias) [published in channels] -> OK, check that publishes get removed + message
	});

	it("rename: properly renames existing aliases", async () => {
		it.skip("rename");
		// $alias rename -> error
		// $alias rename (string) -> error
		// $alias rename (string) (illegal new name) -> error
		// $alias rename (unowned alias) (new name) -> error
	});

	it("restrict: properly restricts existing aliases", async () => {
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

	it("run: properly executes aliases", async () => {
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

	it("transfer: properly transfers aliases between linked user aliases", async () => {
		it.skip("transfer");
		// $alias transfer [not a Twitch user] -> error
		// $alias transfer -> error
		// $alias transfer (nonexistent old username) -> error
		// $alias transfer (old username) [Twitch ID mismatch] -> error
		// $alias transfer (old username) [conflicting new/old aliases] -> error
		// $alias transfer (old username) -> OK, check aliases changing user
	});
});
