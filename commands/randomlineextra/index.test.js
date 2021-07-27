const assert = require("assert");

describe("command: randomlineextra", () => {
	let command;
	let message;
	let index;
	let queryCounter;

	beforeEach(() => {
		queryCounter = 0;
		globalThis.sb = {
			Utils: {
				randArray: arr => arr[0],
				random: (a, b) => Math.trunc(Math.random() * (b - a) + a)
			},
			Query: {
				getRecordset: (callback) => {
					queryCounter++;

					let selectItem;
					const proxy = new Proxy({}, {
						get: function (target, prop) {
							if (prop === "select") {
								return (...args) => {
									selectItem = args[0];
									return proxy;
								};
							}
							else {
								return () => proxy;
							}
						}
					});

					callback(proxy);

					if (selectItem === "MAX(ID) AS ID") {
						return index;
					}
					else if (selectItem === "Text") {
						return message;
					}
					else {
						throw new Error(`Invalid select: ${selectItem}`);
					}
				}
			}
		};

		command = require("./index.js");
		command.staticData = command.Static_Data();
	});

	afterEach(() => {
		delete require.cache[require.resolve("./index.js")];
		delete globalThis.sb;
		command = undefined;
	});

	it("implements proper message behaviour", async () => {
		index = 1;
		message = "Kappa 123";

		const { reply } = await command.Code();

		assert.strictEqual(
			(reply.includes(message)),
			true,
			"Predetermined message was not returned"
		);

		assert.strictEqual(
			queryCounter,
			2,
			"Command did not query proper amount of times"
		);
	});

	it("should re-fetch when getting empty/no messages", async () => {
		index = 0;
		message = "";

		const { success } = await command.Code();

		assert.strictEqual(
			success,
			false,
			"Command did not return success: false"
		);

		assert.strictEqual(
			queryCounter,
			command.staticData.threshold + 1,
			"Command did not query proper amount of times"
		);
	});
});
