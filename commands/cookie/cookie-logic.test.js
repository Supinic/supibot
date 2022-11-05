/* eslint-disable max-nested-callbacks, prefer-arrow-callback */
const assert = require("assert");
const Logic = require("./cookie-logic.js");

globalThis.sb = {
	Date: require("supi-core/objects/date.js")
};

describe("cookie logic", function () {
	describe("initial logic", function () {
		it("can eat daily cookie", function () {
			const data = Logic.getInitialStats();
			const canEat = Logic.canEatDailyCookie(data);
			assert.strictEqual(canEat, true);

			const result = Logic.eatCookie(data);
			const dump = JSON.stringify({ data, result });

			assert.strictEqual(result.success, true, dump);
			assert.strictEqual(data.today.eaten.daily, 1, dump);
			assert.strictEqual(data.today.eaten.received, 0, dump);
			assert.strictEqual(data.today.received, 0, dump);
			assert.strictEqual(data.today.donated, 0, dump);

			assert.strictEqual(data.total.eaten.daily, 1, dump);
			assert.strictEqual(data.total.eaten.received, 0, dump);

			assert.notStrictEqual(data.lastTimestamp.daily, 0, dump);
			assert.strictEqual(data.lastTimestamp.received, 0, dump);
		});

		it("can not eat received cookie", function () {
			const data = Logic.getInitialStats();
			const canEat = Logic.canEatReceivedCookie(data);

			assert.strictEqual(canEat, false);
		});

		it("can not eat donate a cookie if the daily one is not eaten", function () {
			const donator = Logic.getInitialStats();
			const receiver = Logic.getInitialStats();

			const result = Logic.donateCookie(donator, receiver);
			const dump = JSON.stringify({ donator, receiver, result });
			assert.strictEqual(result.success, false, dump);
		});
	});

	describe("multi-step logic", function () {
		it("can eat golden cookie if privileged", function () {
			const data = Logic.getInitialStats();
			const options = { hasDoubleCookieAccess: true };
			assert.strictEqual(data.today.eaten.daily, 0);
			assert.strictEqual(data.total.eaten.daily, 0);

			const firstResult = Logic.eatCookie(data, options);
			assert.strictEqual(firstResult.success, true);
			assert.strictEqual(data.today.eaten.daily, 1);
			assert.strictEqual(data.total.eaten.daily, 1);

			const secondResult = Logic.eatCookie(data, options);
			assert.strictEqual(secondResult.success, true);
			assert.strictEqual(data.today.eaten.daily, 2);
			assert.strictEqual(data.total.eaten.daily, 1); // Total stats do not increase after eating the second cookie
		});

		it("can not donate golden cookie if privileged", function () {
			const donator = Logic.getInitialStats();
			const options = { hasDoubleCookieAccess: true };
			assert.strictEqual(donator.today.eaten.daily, 0);
			assert.strictEqual(donator.total.eaten.daily, 0);

			const firstResult = Logic.eatCookie(donator, options);
			assert.strictEqual(firstResult.success, true);
			assert.strictEqual(donator.today.eaten.daily, 1);
			assert.strictEqual(donator.total.eaten.daily, 1);

			const receiver = Logic.getInitialStats();
			const secondResult = Logic.donateCookie(donator, receiver, options);
			assert.strictEqual(secondResult.success, false);

			assert.strictEqual(donator.today.donated, 0);
			assert.strictEqual(receiver.today.received, 0);
		});

		it("can donate cookie and eat it", function () {
			const donator = Logic.getInitialStats();
			const receiver = Logic.getInitialStats();
			Logic.eatCookie(receiver);

			const result = Logic.donateCookie(donator, receiver);
			assert.strictEqual(result.success, true);

			const dump = JSON.stringify({ donator, receiver, result });

			assert.strictEqual(result.success, true, dump);
			assert.strictEqual(donator.today.eaten.daily, 0, dump);
			assert.strictEqual(donator.today.eaten.received, 0, dump);
			assert.strictEqual(donator.today.received, 0, dump);
			assert.strictEqual(donator.today.donated, 1, dump);

			assert.strictEqual(donator.total.eaten.daily, 0, dump);
			assert.strictEqual(donator.total.eaten.received, 0, dump);

			assert.notStrictEqual(donator.lastTimestamp.daily, 0, dump);
			assert.strictEqual(donator.lastTimestamp.received, 0, dump);

			assert.strictEqual(receiver.today.eaten.daily, 1, dump);
			assert.strictEqual(receiver.today.eaten.received, 0, dump);
			assert.strictEqual(receiver.today.received, 1, dump);
			assert.strictEqual(receiver.today.donated, 0, dump);

			assert.strictEqual(receiver.total.eaten.daily, 1, dump);
			assert.strictEqual(receiver.total.eaten.received, 0, dump);

			assert.notStrictEqual(receiver.lastTimestamp.daily, 0, dump);
			assert.notStrictEqual(receiver.lastTimestamp.received, 0, dump);

			const canEatReceived = Logic.canEatReceivedCookie(receiver);
			assert.strictEqual(canEatReceived, true);

			Logic.eatCookie(receiver);
			assert.strictEqual(Logic.hasDonatedDailyCookie(donator), true);
		});
	});
});
