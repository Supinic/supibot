/* global it, describe, beforeEach, afterEach */
/* eslint-disable prefer-arrow-callback */
const assert = require("node:assert");

const Channel = require("../../classes/channel.js");
const Command = require("../../classes/command.js");
const Platform = require("../../classes/platform.js");
const User = require("../../classes/user.js");

require("@kararty/dank-twitch-irc");
const MockTwitchClient = require("./mock-client.js");
require.cache[require.resolve("@kararty/dank-twitch-irc")].exports = MockTwitchClient;

const initialize = (async () => {
	const { Date, Config } = await import("supi-core");
	globalThis.sb = {
		Date,
		Config,
		Utils: {
			wrapString: string => string
		},

		User,
		Channel,
		Platform,
		Command
	};

	sb.User.data = new Map([
		["supinic", new User({ Name: "supinic", Twitch_ID: "31400525" })],
		["mm2pl", new User({ Name: "mm2pl", Twitch_ID: "117691339" })],
		["mickeyzzzz", new User({ Name: "mickeyzzzz", Twitch_ID: "161967202" })]
	]);

	sb.AwayFromKeyboard = { checkActive: () => void 0 };
	sb.Reminder = { checkActive: () => void 0 };

	sb.Platform.data = [new Platform({
		Name: "twitch",
		Self_Name: "supibot"
	})];

	// noinspection JSConstantReassignment
	sb.Channel.data = new Map().set(Platform.data[0], new Map([
		[
			"supinic",
			new sb.Channel({
				Name: "supinic",
				Platform: "twitch",
				Mode: "Write"
			})
		],
		[
			"forsen",
			new sb.Channel({
				Name: "forsen",
				Platform: "twitch",
				Mode: "Write"
			})
		]
	]));

	sb.Command.data = [];
	sb.Config.data = new Map([
		["TWITCH_OAUTH", new Config({
			Name: "TWITCH_OAUTH",
			Value: "xd",
			Type: "string"
		})],
		["TWITCH_CLIENT_ID", new Config({
			Name: "TWITCH_CLIENT_ID",
			Value: "xd",
			Type: "string"
		})],
		["COMMAND_PREFIX", new Config({
			Name: "COMMAND_PREFIX",
			Value: "$",
			Type: "string"
		})]
	]);

	sb.Got = {
		get: () => ({
			extend: () => {}
		})
	};

	sb.Cache = {
		setByPrefix: () => {}
	};

	const userCheck = await User.get("supinic");
	assert.strictEqual(userCheck instanceof User, true);

	const channelCheck = Channel.get("supinic");
	assert.strictEqual(channelCheck instanceof Channel, true);

	assert.strictEqual(Command.prefix, "$");
	assert.strictEqual(Command.is("$test"), true);
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

	// it("adds a channel to join later when a JoinError is encountered", function () {
	// 	const error = new MockTwitchClient.JoinError("Failed to say message: 123");
	// 	error.failedChannelName = "twitch";
	//
	// 	controller.client.emit("error", error);
	//
	// 	assert.strictEqual(controller.failedJoinChannels.size, 1);
	// });
});
