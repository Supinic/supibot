import { it, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";

import * as Logic from "../../../commands/cookie/cookie-logic.js";
import { TestWorld } from "../../test-utils.js";
import { isResultFailure } from "../../../classes/command.js";

// Allow proper simple object cloning when `structuredClone` is not available, e.g. in workers or in GitHub CI
globalThis.structuredClone ??= (input) => JSON.parse(JSON.stringify(input));

const notPrivileged = Object.freeze({ hasDoubleCookieAccess: false });
const privileged = Object.freeze({ hasDoubleCookieAccess: true });

describe("cookie logic", () => {
	const world = new TestWorld();
	beforeEach(() => { world.install(); });
	afterEach(() => { world.reset(); });

	describe("initial logic", () => {
		it("can eat daily cookie", () => {
			const data = Logic.getInitialCookieStats();
			const canEat = Logic.canEatDailyCookie(data, notPrivileged);
			assert.strictEqual(canEat, true);

			const result = Logic.eatCookie(data, notPrivileged);
			assert.ok(!isResultFailure(result));

			assert.strictEqual(data.today.eaten.daily, 1);
			assert.strictEqual(data.today.eaten.received, 0);
			assert.strictEqual(data.today.received, 0);
			assert.strictEqual(data.today.donated, 0);

			assert.strictEqual(data.total.eaten.daily, 1);
			assert.strictEqual(data.total.eaten.received, 0);

			assert.notStrictEqual(data.lastTimestamp.daily, 0);
			assert.strictEqual(data.lastTimestamp.received, 0);
		});

		it("can not eat received cookie", () => {
			const data = Logic.getInitialCookieStats();
			const canEat = Logic.canEatReceivedCookie(data);

			assert.strictEqual(canEat, false);
		});

		it("can not donate a cookie if the receiver's daily cookie is not eaten yet", () => {
			const donator = Logic.getInitialCookieStats();
			const receiver = Logic.getInitialCookieStats();

			const result = Logic.donateCookie(donator, receiver, notPrivileged, notPrivileged);
			assert.ok(isResultFailure(result));
			assert.match(result.reply, /hasn't eaten their daily/);
		});
	});

	describe("multi-step logic", () => {
		it("can eat golden cookie if privileged", () => {
			const data = Logic.getInitialCookieStats();
			assert.strictEqual(data.today.eaten.daily, 0);
			assert.strictEqual(data.total.eaten.daily, 0);

			const firstResult = Logic.eatCookie(data, privileged);
			assert.ok(!isResultFailure(firstResult));
			assert.strictEqual(data.today.eaten.daily, 1);
			assert.strictEqual(data.total.eaten.daily, 1);

			const secondResult = Logic.eatCookie(data, privileged);
			assert.ok(!isResultFailure(secondResult));
			assert.strictEqual(data.today.eaten.daily, 2);
			assert.strictEqual(data.total.eaten.daily, 1); // Total stats do not increase after eating the second cookie
		});

		it("can donate, then eat golden cookie if privileged", () => {
			const receiver = Logic.getInitialCookieStats();
			const firstEatResult = Logic.eatCookie(receiver, notPrivileged);
			assert.ok(!isResultFailure(firstEatResult));

			const donator = Logic.getInitialCookieStats();
			const donationResult = Logic.donateCookie(donator, receiver, privileged, notPrivileged);
			assert.ok(!isResultFailure(donationResult));

			const secondEatResult = Logic.eatCookie(donator, privileged);
			assert.ok(!isResultFailure(secondEatResult));

			assert.strictEqual(donator.today.eaten.daily, 1);
			assert.strictEqual(donator.total.eaten.daily, 0); // Total stats should not increase after eating the second cookie
		});

		it("can not donate golden cookie if privileged", () => {
			const donator = Logic.getInitialCookieStats();
			assert.strictEqual(donator.today.eaten.daily, 0);
			assert.strictEqual(donator.total.eaten.daily, 0);

			const firstResult = Logic.eatCookie(donator, privileged);
			assert.ok(!isResultFailure(firstResult));
			assert.strictEqual(donator.today.eaten.daily, 1);
			assert.strictEqual(donator.total.eaten.daily, 1);

			const receiver = Logic.getInitialCookieStats();
			const secondResult = Logic.donateCookie(donator, receiver, privileged, notPrivileged);
			assert.ok(isResultFailure(secondResult));

			assert.strictEqual(donator.today.donated, 0);
			assert.strictEqual(receiver.today.received, 0);
		});

		it("can donate cookie and eat it", () => {
			const donator = Logic.getInitialCookieStats();
			const receiver = Logic.getInitialCookieStats();

			const firstEatResult = Logic.eatCookie(receiver, notPrivileged);
			assert.ok(!isResultFailure(firstEatResult));

			const donationResult = Logic.donateCookie(donator, receiver, notPrivileged, notPrivileged);
			assert.ok(!isResultFailure(donationResult));

			assert.strictEqual(donator.today.eaten.daily, 0);
			assert.strictEqual(donator.today.eaten.received, 0);
			assert.strictEqual(donator.today.received, 0);
			assert.strictEqual(donator.today.donated, 1);

			assert.strictEqual(donator.total.eaten.daily, 0);
			assert.strictEqual(donator.total.eaten.received, 0);

			assert.notStrictEqual(donator.lastTimestamp.daily, 0);
			assert.strictEqual(donator.lastTimestamp.received, 0);

			assert.strictEqual(receiver.today.eaten.daily, 1);
			assert.strictEqual(receiver.today.eaten.received, 0);
			assert.strictEqual(receiver.today.received, 1);
			assert.strictEqual(receiver.today.donated, 0);

			assert.strictEqual(receiver.total.eaten.daily, 1);
			assert.strictEqual(receiver.total.eaten.received, 0);

			assert.notStrictEqual(receiver.lastTimestamp.daily, 0);
			assert.notStrictEqual(receiver.lastTimestamp.received, 0);

			const canEatReceived = Logic.canEatReceivedCookie(receiver);
			assert.strictEqual(canEatReceived, true);

			const secondEatResult = Logic.eatCookie(receiver, notPrivileged);
			assert.ok(!isResultFailure(secondEatResult));

			assert.strictEqual(Logic.hasDonatedDailyCookie(donator), true);
		});

		it("can gift a cookie, eat one, but not two - if privileged", () => {
			const donator = Logic.getInitialCookieStats();
			const receiver = Logic.getInitialCookieStats();

			const eatResult = Logic.eatCookie(receiver, notPrivileged);
			assert.ok(!isResultFailure(eatResult));

			const donateResult = Logic.donateCookie(donator, receiver, privileged, notPrivileged);
			assert.ok(!isResultFailure(donateResult));

			const firstResult = Logic.eatCookie(donator, privileged);
			assert.ok(!isResultFailure(firstResult));
			assert.strictEqual(firstResult.type, "golden");

			const secondResult = Logic.eatCookie(donator, privileged);
			assert.ok(isResultFailure(secondResult));
		});

		it("cannot donate an already donated cookie", () => {
			const userOne = Logic.getInitialCookieStats();
			const userTwo = Logic.getInitialCookieStats();

			const eatResult = Logic.eatCookie(userOne, notPrivileged);
			assert.ok(!isResultFailure(eatResult));

			const firstDonateResult = Logic.donateCookie(userTwo, userOne, notPrivileged, notPrivileged);
			assert.ok(!isResultFailure(firstDonateResult));

			const secondDonateResult = Logic.donateCookie(userOne, userTwo, notPrivileged, notPrivileged);
			assert.ok(isResultFailure(secondDonateResult));
		});

		it("cannot donate cookie to someone who already has a donated cookie pending", () => {
			const userOne = Logic.getInitialCookieStats();
			const userTwo = Logic.getInitialCookieStats();
			const userThree = Logic.getInitialCookieStats();

			const eatResult = Logic.eatCookie(userOne, notPrivileged);
			assert.ok(!isResultFailure(eatResult));

			const firstDonateResult = Logic.donateCookie(userTwo, userOne, notPrivileged, notPrivileged);
			assert.ok(!isResultFailure(firstDonateResult));

			const secondDonateResult = Logic.donateCookie(userThree, userOne, notPrivileged, notPrivileged);
			assert.ok(isResultFailure(secondDonateResult));
		});

		it("cannot donate cookie to privileged user who didn't eat their golden cookie", () => {
			const userOne = Logic.getInitialCookieStats();
			const userTwo = Logic.getInitialCookieStats();

			const eatResult = Logic.eatCookie(userOne, privileged);
			assert.ok(!isResultFailure(eatResult));

			const donateResult = Logic.donateCookie(userTwo, userOne, notPrivileged, privileged);
			assert.ok(isResultFailure(donateResult));
		});

		it("cannot donate if already eaten", () => {
			const userOne = Logic.getInitialCookieStats();
			const userTwo = Logic.getInitialCookieStats();

			const eatResult = Logic.eatCookie(userOne, notPrivileged);
			assert.ok(!isResultFailure(eatResult));

			const donateResult = Logic.donateCookie(userOne, userTwo, notPrivileged, notPrivileged);
			assert.ok(isResultFailure(donateResult));
		});

		it("cannot donate if already donated", () => {
			const donator = Logic.getInitialCookieStats();
			const receiver = Logic.getInitialCookieStats();

			// Eat the receiver's daily cookie first, so that donating actually goes through -> should pass
			const eatResult = Logic.eatCookie(receiver, notPrivileged);
			assert.ok(!isResultFailure(eatResult));

			// Donator donates their cookie away -> should pass
			const firstResult = Logic.donateCookie(donator, receiver, notPrivileged, notPrivileged);
			assert.ok(!isResultFailure(firstResult));

			// Donator attempts to donate again -> should fail
			const secondResult = Logic.donateCookie(donator, receiver, notPrivileged, notPrivileged);
			assert.ok(isResultFailure(secondResult));
		});

		// explicitly test Logic.eatDailyCookie and Logic.eatReceivedCookie if not possible
	});

	describe("meta operations", () => {
		it("properly resets daily stats after usage", () => {
			const data = Logic.getInitialCookieStats();
			const eatResult = Logic.eatCookie(data, notPrivileged);
			assert.ok(!isResultFailure(eatResult));

			const isOutdated = Logic.hasOutdatedDailyCookieStats(data);
			assert.strictEqual(isOutdated, false);

			// Pretend that the timestamp has aged 1 day
			data.lastTimestamp.daily -= 864e5;

			const isOutdatedAfter = Logic.hasOutdatedDailyCookieStats(data);
			assert.strictEqual(isOutdatedAfter, true);

			Logic.resetDailyCookieStats(data);
			assert.strictEqual(data.lastTimestamp.daily, 0);
			assert.strictEqual(data.today.donated, 0);
			assert.strictEqual(data.today.received, 0);
			assert.strictEqual(data.today.eaten.daily, 0);
			assert.strictEqual(data.today.eaten.received, 0);
		});

		it("allows eating a cookie after stats are reset", () => {
			const data = Logic.getInitialCookieStats();
			const firstResult = Logic.eatCookie(data, notPrivileged);
			assert.ok(!isResultFailure(firstResult));

			Logic.resetDailyCookieStats(data);

			const canEat = Logic.canEatDailyCookie(data, notPrivileged);
			assert.strictEqual(canEat, true);

			const secondResult = Logic.eatCookie(data, notPrivileged);
			assert.ok(!isResultFailure(secondResult));
		});

		it("allows donating a cookie after stats are reset", () => {
			const userOne = Logic.getInitialCookieStats();
			const userTwo = Logic.getInitialCookieStats();

			const oneEatResult = Logic.eatCookie(userOne, notPrivileged);
			assert.ok(!isResultFailure(oneEatResult));
			const twoEatResult = Logic.eatCookie(userTwo, notPrivileged);
			assert.ok(!isResultFailure(twoEatResult));

			Logic.resetDailyCookieStats(userOne);

			const canEat = Logic.hasDonatedDailyCookie(userOne);
			assert.strictEqual(canEat, false);

			const result = Logic.donateCookie(userOne, userTwo, notPrivileged, notPrivileged);
			assert.ok(!isResultFailure(result));
		});

		it("cannot execute `Logic.eatDailyCookie` if already eaten", () => {
			const userOne = Logic.getInitialCookieStats();

			const eatResult = Logic.eatCookie(userOne, notPrivileged);
			assert.ok(!isResultFailure(eatResult));

			const result = Logic.eatDailyCookie(userOne, notPrivileged);
			assert.strictEqual(result, false);
		});

		it("cannot execute `Logic.eatReceivedCookie` if none is available", () => {
			const userOne = Logic.getInitialCookieStats();
			const result = Logic.eatReceivedCookie(userOne);
			assert.strictEqual(result, false);
		});

		// explicitly test Logic.eatDailyCookie and Logic.eatReceivedCookie if not possible
	});
});
