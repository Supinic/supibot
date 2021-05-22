/* global it, describe, beforeEach, afterEach */
/* eslint-disable prefer-arrow-callback */
const assert = require("assert");

require("dank-twitch-irc");
const MockTwitchClient = require("./mock-client.js");
require.cache[require.resolve("dank-twitch-irc")].exports = MockTwitchClient;

const initialize = (async () => {
	await require("supi-core")("sb", {
		whitelist: [
			"objects/date",
			"objects/error",
			"classes/channel",
			"classes/command",
			"classes/config",
			"classes/cron",
			"classes/platform",
			"classes/user"
		],
		skipData: [
			"classes/channel",
			"classes/command",
			"classes/config",
			"classes/cron",
			"classes/platform",
			"classes/user"
		]
	});

	sb.Utils = {
		wrapString: string => string
	};

	sb.User.data = new Map([
		["supinic", new sb.User({ Name: "supinic" })],
		["mm2pl", new sb.User({ Name: "mm2pl" })],
		["mickeyzzzz", new sb.User({ Name: "mickeyzzzz" })]
	]);

	sb.AwayFromKeyboard = { checkActive: () => void 0 };
	sb.Reminder = { checkActive: () => void 0 };

	sb.Platform.data = [new sb.Platform({
		Name: "twitch",
		Self_Name: "supibot"
	})];

	sb.Channel.data = [
		new sb.Channel({
			Name: "supinic",
			Platform: "twitch",
			Mode: "Write"
		}),
		new sb.Channel({
			Name: "forsen",
			Platform: "twitch",
			Mode: "Write"
		})
	];

	sb.Command.data = [];
	sb.Config.data = new Map([
		["TWITCH_OAUTH", new sb.Config({
			Name: "TWITCH_OAUTH",
			Value: "xd",
			Type: "string"
		})],
		["TWITCH_CLIENT_ID", new sb.Config({
			Name: "TWITCH_CLIENT_ID",
			Value: "xd",
			Type: "string"
		})],
		["COMMAND_PREFIX", new sb.Config({
			Name: "COMMAND_PREFIX",
			Value: "$",
			Type: "string"
		})]
	]);

	const userCheck = await sb.User.get("supinic");
	assert.strictEqual(userCheck instanceof sb.User, true);

	const channelCheck = sb.Channel.get("supinic");
	assert.strictEqual(channelCheck instanceof sb.Channel, true);

	assert.strictEqual(sb.Command.prefix, "$");
	assert.strictEqual(sb.Command.is("$test"), true);
});

describe("twitch controller", function () {
	let TwitchController;
	let controller;

	beforeEach(async () => {
		const log = console.log;
		console.log = () => undefined;
		await initialize();
		console.log = log;

		delete require.cache[require.resolve("../../controllers/twitch.js")];

		console.stuff = [];
		TwitchController = require("../../controllers/twitch.js");
		controller = new TwitchController();
	});

	afterEach(() => {
		delete global.sb;
	});

	it("handles chat messages", function () {
		const testMessages = require("./messages.json");
		controller.client.emit("PRIVMSG", testMessages[0]);

		return true;
	});

	it("handles command invocation messages", function (done) {
		const expected = { reply: "Expected command result" };
		sb.Command.checkAndExecute = () => expected;

		const invoked = {};
		controller.send = (reply) => {
			assert.strictEqual(invoked.message, true);
			assert.strictEqual(invoked.command, true);
			assert.strictEqual(reply, expected.reply);

			done();
		};

		controller._handleMessage = controller.handleMessage;
		controller.handleMessage = (...args) => {
			invoked.message = true;
			return controller._handleMessage(...args);
		};

		controller._handleCommand = controller.handleCommand;
		controller.handleCommand = (...args) => {
			invoked.command = true;
			return controller._handleCommand(...args);
		};

		const testMessages = require("./messages.json");
		const message = testMessages[1];
		message.extractUserState = () => ({});

		controller.client.emit("PRIVMSG", message);
	});

	it("handles client errors", function () {
		controller.client.emit("error", new Error("lol"));

		return true;
	});

	it("adds a channel to join later when a JoinError is encountered", function () {
		const error = new MockTwitchClient.JoinError("Failed to say message: 123");
		error.failedChannelName = "twitch";

		controller.client.emit("error", error);

		assert.strictEqual(controller.failedJoinChannels.size, 1);
	});
});
