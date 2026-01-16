import { it, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";

import Logic from "./cookie-logic.js";
import { TestWorld } from "../../tests/test-utils.js";

// Allow proper object cloning when `structuredClone` is not available
// E.g. in workers
// eslint-disable-next-line
globalThis.structuredClone ??= (input) => JSON.parse(JSON.stringify(input));

const notPrivileged = Object.freeze({ hasDoubleCookieAccess: false });
const privileged = Object.freeze({ hasDoubleCookieAccess: true });

describe("cookie logic", () => {
	const world = new TestWorld();
	beforeEach(() => { world.install(); });
	afterEach(() => { world.reset(); });

	describe("initial logic", () => {
		it("can eat daily cookie", () => {
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

		it("can not eat received cookie", () => {
			const data = Logic.getInitialStats();
			const canEat = Logic.canEatReceivedCookie(data);

			assert.strictEqual(canEat, false);
		});

		it("can not donate a cookie if the daily one is not eaten", () => {
			const donator = Logic.getInitialStats();
			const receiver = Logic.getInitialStats();

			const result = Logic.donateCookie(donator, receiver);
			const dump = JSON.stringify({ donator, receiver, result });
			assert.strictEqual(result.success, false, dump);
		});
	});

	describe("multi-step logic", () => {
		it("can eat golden cookie if privileged", () => {
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

		it("can donate, then eat golden cookie if privileged", () => {
			const receiver = Logic.getInitialStats();
			Logic.eatCookie(receiver);

			const donator = Logic.getInitialStats();
			Logic.donateCookie(donator, receiver);

			const result = Logic.eatCookie(donator, privileged);
			assert.strictEqual(result.success, true);
			assert.strictEqual(donator.today.eaten.daily, 1);
			assert.strictEqual(donator.total.eaten.daily, 0); // Total stats do not increase after eating the second cookie
		});

		it("can not donate golden cookie if privileged", () => {
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

		it("can donate cookie and eat it", () => {
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

		it("can gift a cookie, eat one, but not two - if privileged", () => {
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

		it("cannot donate an already donated cookie", () => {
			const userOne = Logic.getInitialStats();
			const userTwo = Logic.getInitialStats();

			Logic.eatCookie(userOne);
			Logic.donateCookie(userTwo, userOne);

			const result = Logic.donateCookie(userOne, userTwo);
			assert.strictEqual(result.success, false);
		});

		it("cannot donate cookie to someone who already has a donated cookie pending", () => {
			const userOne = Logic.getInitialStats();
			const userTwo = Logic.getInitialStats();
			const userThree = Logic.getInitialStats();

			Logic.eatCookie(userOne);
			Logic.donateCookie(userTwo, userOne);

			const result = Logic.donateCookie(userThree, userOne);
			assert.strictEqual(result.success, false);
		});

		it("cannot donate cookie to privileged user who didn't eat their golden cookie", () => {
			const userOne = Logic.getInitialStats();
			const userTwo = Logic.getInitialStats();

			Logic.eatCookie(userOne, privileged);

			const result = Logic.donateCookie(userTwo, userOne, notPrivileged, privileged);
			assert.strictEqual(result.success, false);
		});

		it("cannot donate if already eaten", () => {
			const userOne = Logic.getInitialStats();
			const userTwo = Logic.getInitialStats();

			Logic.eatCookie(userOne);

			const result = Logic.donateCookie(userOne, userTwo, notPrivileged, notPrivileged);
			assert.strictEqual(result.success, false);
		});

		it("cannot donate if already donated", () => {
			const userOne = Logic.getInitialStats();
			const userTwo = Logic.getInitialStats();

			Logic.donateCookie(userOne, userTwo, notPrivileged, notPrivileged);

			const result = Logic.donateCookie(userOne, userTwo, notPrivileged, notPrivileged);
			assert.strictEqual(result.success, false);
		});

		// explicitly test Logic.eatDailyCookie and Logic.eatReceivedCookie if not possible
	});

	describe("meta operations", () => {
		it("properly resets daily stats after usage", () => {
			const data = Logic.getInitialStats();

			Logic.eatCookie(data);

			const isOutdated = Logic.hasOutdatedDailyStats(data);
			assert.strictEqual(isOutdated, false);

			// Pretend that the timestamp has aged 1 day
			data.lastTimestamp.daily -= 864e5;

			const isOutdatedAfter = Logic.hasOutdatedDailyStats(data);
			assert.strictEqual(isOutdatedAfter, true);

			Logic.resetDailyStats(data);
			assert.strictEqual(data.lastTimestamp.daily, 0);
			assert.strictEqual(data.today.donated, 0);
			assert.strictEqual(data.today.received, 0);
			assert.strictEqual(data.today.eaten.daily, 0);
			assert.strictEqual(data.today.eaten.received, 0);
		});

		it("allows eating a cookie after stats are reset", () => {
			const data = Logic.getInitialStats();
			Logic.eatCookie(data, notPrivileged);

			Logic.resetDailyStats(data);

			const canEat = Logic.canEatDailyCookie(data, notPrivileged);
			assert.strictEqual(canEat, true);

			const result = Logic.eatCookie(data, notPrivileged);
			assert.strictEqual(result.success, true);
		});

		it("allows donating a cookie after stats are reset", () => {
			const userOne = Logic.getInitialStats();
			const userTwo = Logic.getInitialStats();
			Logic.eatCookie(userOne, notPrivileged);
			Logic.eatCookie(userTwo, notPrivileged);

			Logic.resetDailyStats(userOne);

			const canEat = Logic.hasDonatedDailyCookie(userOne);
			assert.strictEqual(canEat, false);

			const result = Logic.donateCookie(userOne, userTwo, notPrivileged, notPrivileged);
			assert.strictEqual(result.success, true, JSON.stringify(result));
		});

		it("cannot execute `Logic.eatDailyCookie` if already eaten", () => {
			const userOne = Logic.getInitialStats();

			Logic.eatCookie(userOne, notPrivileged);

			const result = Logic.eatDailyCookie(userOne, notPrivileged);
			assert.strictEqual(result, false);
		});

		it("cannot execute `Logic.eatReceivedCookie` if none is available", () => {
			const userOne = Logic.getInitialStats();
			const result = Logic.eatReceivedCookie(userOne);
			assert.strictEqual(result, false);
		});

		// explicitly test Logic.eatDailyCookie and Logic.eatReceivedCookie if not possible
	});
});
