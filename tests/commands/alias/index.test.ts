import { it, describe } from "node:test";
import assert from "node:assert/strict";

import * as core from "supi-core";
// @ts-ignore
globalThis.core = {
	Utils: new core.Utils()
};

import { Command } from "../../../classes/command.js";
import { User } from "../../../classes/user.js";
import { Platform } from "../../../platforms/template.js";

import aliasCommandDefinition from "../../../commands/alias/index.js";

const [command] = Command.importSpecific(aliasCommandDefinition);

const FakeUser = new User({
	ID: 1,
	Name: "TestUser",
	Twitch_ID: null,
	Discord_ID: null,
	Started_Using: null
});
const FakePlatform = await Platform.create("unknown", {
	ID: -1,
	active: true,
	platform: {},
	logging: {},
	messageLimit: 1000,
	selfId: "123",
	selfName: "Supibot"
});

const fakeContext = Command.createFakeContext(command, {
	user: FakeUser,
	channel: null,
	platform: FakePlatform,
	platformSpecificData: null
});

describe("Test xd", () => {
	it("test 123", async () => {
		try {
			// const result = await command.execute(fakeContext, "alias", "list");
			const result = {};
			console.log({ result });
		}
		catch (e) {
			console.log({ e });
		}
	});
});
