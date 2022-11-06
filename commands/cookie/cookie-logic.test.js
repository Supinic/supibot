/* eslint-disable max-nested-callbacks, prefer-arrow-callback */
const assert = require("assert");
const Logic = require("./cookie-logic.js");

globalThis.sb = {
	Date: require("supi-core/objects/date.js"),
	Utils: {
		timeDelta: (date) => date.toString(),
		random: () => 0
	}
};

const notPrivileged = Object.freeze({ hasDoubleCookieAccess: false });
const privileged = Object.freeze({ hasDoubleCookieAccess: true });

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

		it("can not donate a cookie if the daily one is not eaten", function () {
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
			assert.strictEqual(data.today.eaten.daily, 0);
			assert.strictEqual(data.total.eaten.daily, 0);

			const firstResult = Logic.eatCookie(data, privileged);
			assert.strictEqual(firstResult.success, true);
			assert.strictEqual(data.today.eaten.daily, 1);
			assert.strictEqual(data.total.eaten.daily, 1);

			const secondResult = Logic.eatCookie(data, privileged);
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

		it("can gift a cookie, eat one, but not two - if privileged", function () {
			const donator = Logic.getInitialStats();
			const receiver = Logic.getInitialStats();

			Logic.eatCookie(receiver);
			const donateResult = Logic.donateCookie(donator, receiver);
			assert.strictEqual(donateResult.success, true);

			const firstResult = Logic.eatCookie(donator, privileged);
			assert.strictEqual(firstResult.success, true);
			assert.strictEqual(firstResult.type, "golden");

			const secondResult = Logic.eatCookie(donator, privileged);
			assert.strictEqual(secondResult.success, false);
		});

		it("cannot donate an already donated cookie", function () {
			const userOne = Logic.getInitialStats();
			const userTwo = Logic.getInitialStats();

			Logic.eatCookie(userOne);
			Logic.donateCookie(userTwo, userOne);

			const result = Logic.donateCookie(userOne, userTwo);
			assert.strictEqual(result.success, false);
		});

		it("cannot donate cookie to someone who already has a donated cookie pending", function () {
			const userOne = Logic.getInitialStats();
			const userTwo = Logic.getInitialStats();
			const userThree = Logic.getInitialStats();

			Logic.eatCookie(userOne);
			Logic.donateCookie(userTwo, userOne);

			const result = Logic.donateCookie(userThree, userOne);
			assert.strictEqual(result.success, false);
		});

		it("cannot donate cookie to privileged user who didn't eat their golden cookie", function () {
			const userOne = Logic.getInitialStats();
			const userTwo = Logic.getInitialStats();

			Logic.eatCookie(userOne, privileged);

			const result = Logic.donateCookie(userTwo, userOne, notPrivileged, privileged);
			assert.strictEqual(result.success, false);
		});

		it("cannot donate if already eaten", function () {
			const userOne = Logic.getInitialStats();
			const userTwo = Logic.getInitialStats();

			Logic.eatCookie(userOne);

			const result = Logic.donateCookie(userOne, userTwo, notPrivileged, notPrivileged);
			assert.strictEqual(result.success, false);
		});

		it("cannot donate if already donated", function () {
			const userOne = Logic.getInitialStats();
			const userTwo = Logic.getInitialStats();

			Logic.donateCookie(userOne, userTwo, notPrivileged, notPrivileged);

			const result = Logic.donateCookie(userOne, userTwo, notPrivileged, notPrivileged);
			assert.strictEqual(result.success, false);
		});

		// explicitly test Logic.eatDailyCookie and Logic.eatReceivedCookie if not possible
	});

	describe("meta operations", function () {
		it("properly resets daily stats after usage", function () {
			const today = sb.Date.getTodayUTC();
			const data = Logic.getInitialStats();
			assert.strictEqual(data.lastTimestamp.daily, 0);

			Logic.eatCookie(data);
			assert.strictEqual(data.lastTimestamp.daily, today);

			const isOutdated = Logic.hasOutdatedDailyStats(data);
			assert.strictEqual(isOutdated, false);

			// Pretend that the timestamp has aged 1 day
			data.lastTimestamp.daily -= 864e5;

			const isOutdatedAfter = Logic.hasOutdatedDailyStats(data);
			assert.strictEqual(isOutdatedAfter, true);

			Logic.resetDailyStats(data);
			assert.strictEqual(data.lastTimestamp.daily, today);
			assert.strictEqual(data.today.donated, 0);
			assert.strictEqual(data.today.eaten.daily, 0);
			assert.strictEqual(data.today.eaten.received, 0);
		});

		it("cannot execute `Logic.eatDailyCookie` if already eaten", function () {
			const userOne = Logic.getInitialStats();

			Logic.eatCookie(userOne, notPrivileged);

			const result = Logic.eatDailyCookie(userOne, notPrivileged);
			assert.strictEqual(result, false);
		});

		it("cannot execute `Logic.eatReceivedCookie` if none is available", function () {
			const userOne = Logic.getInitialStats();
			const result = Logic.eatReceivedCookie(userOne);
			assert.strictEqual(result, false);
		});

		// explicitly test Logic.eatDailyCookie and Logic.eatReceivedCookie if not possible
	});

	describe("parsing subcommands", function () {
		const validInputs = Logic.subcommands.flatMap(i => [i.name, ...i.aliases]);
		const defaultSubcommand = Logic.subcommands.find(i => i.default === true);

		it("parses no input", function () {
			const result = Logic.parseSubcommand();
			assert.strictEqual(result, defaultSubcommand.name);
		});

		it("parses proper input", function () {
			for (const validInput of validInputs) {
				const subcommand = Logic.subcommands.find(i => i.name === validInput || i.aliases.includes(validInput));
				const result = Logic.parseSubcommand(validInput);
				assert.strictEqual(result, subcommand.name);
			}
		});

		it("rejects invalid input", function () {
			const result = Logic.parseSubcommand("this should never pass");
			assert.strictEqual(result, null);
		});
	});
});
