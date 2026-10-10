import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it, mock } from "node:test";
import { createTestChannel, createTestPlatform, createTestUser, TestWorld } from "../../test-utils.ts";

describe("link-gatherer", async () => {
	const extensions = ["jpg", "jpeg", "png", "gif", "mp4"];
	const providers = [
		{
			name: "imgur",
			hostnames: ["imgur.com", "i.imgur.com"],
			slugPattern: "[A-Za-z0-9]{5,8}",
			extensions
		},
		{
			name: "twitter",
			hostnames: ["pbs.twimg.com/media"],
			slugPattern: "[A-Za-z0-9_-]+",
			extensions,
			formatParameter: "format"
		},
		{
			name: "path",
			hostnames: ["withpath.com/upload"],
			slugPattern: "[A-Za-z0-9]{6}",
			extensions
		}
	];

	const configMock = mock.module("../../../config.ts", {
		exports: {
			getConfig: () => ({
				modules: {
					"chat-modules": {
						"link-gatherer": { providers }
					}
				}
			})
		}
	});
	after(() => configMock.restore());

	const linkGatherer = (await import("../../../chat-modules/link-gatherer/index.ts")).default;
	const world = new TestWorld();
	world.failOnEmptyRecordset = false;

	beforeEach(() => {
		world.reset();
		world.install();
	});
	afterEach(() => {
		assert.strictEqual(world.rows.length, world.rows.filter(i => i.stored).length, "Every created row should be saved");
	});

	const execute = linkGatherer.handlers?.message;
	assert.ok(execute, "Link gatherer does not have a message handler");

	const getSourceRecords = () => world.rows
		.filter(i => i.table === "Media_Source")
		.map(i => ({
			Host: i.values.Host,
			Slug: i.values.Slug,
			Extension: i.values.Extension
		}));

	const platform = createTestPlatform({ selfName: "bot" });
	const channel = createTestChannel(1, platform);
	const user = createTestUser({ Name: "viewer", ID: 1, Twitch_ID: "viewer-id" });

	const runMessage = async (message: string) => await execute(
		{ message, user, platform, channel, event: "message", data: { customRewardId: null } },
		{ config: undefined, state: undefined }
	);

	it("matches configured hosts and filters invalid slugs and extensions", async () => {
		await runMessage("https://imgur.com/abcde.jpg https://i.imgur.com/foobar.png https://imgur.com/abcdefghi.jpg https://imgur.com/valid.webp");

		assert.deepEqual(getSourceRecords(), [
			{ Host: "imgur", Slug: "abcde", Extension: "jpg" },
			{ Host: "imgur", Slug: "foobar", Extension: "png" }
		]);
	});

	it("takes Twitter's format from its configured query parameter", async () => {
		await runMessage("https://pbs.twimg.com/media/ASDFGHJKL?format=jpg&name=medium https://pbs.twimg.com/media/Kappa123.gif?format=png&name=small");

		assert.deepEqual(getSourceRecords(), [
			{ Host: "twitter", Slug: "ASDFGHJKL", Extension: "jpg" },
			{ Host: "twitter", Slug: "Kappa123", Extension: "png" }
		]);
	});

	it("matches providers whose hostname includes an interim path", async () => {
		await runMessage("https://withpath.com/upload/barbaz.jpeg");

		assert.deepEqual(getSourceRecords(), [
			{ Host: "path", Slug: "barbaz", Extension: "jpeg" }
		]);
	});
});
