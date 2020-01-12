/**
 *
 * @module CooldownManager
 */
/* global sb */
module.exports = (function (Module) {
	"use strict";

	class Cooldown {
		#channel = null;
		#user = null;
		#command = null;
		#expires = null;

		/**
		 * Creates a cooldown instance.
		 * @param {Object} data
		 * @param {number|null} data.channel
		 * @param {number|null} data.user
		 * @param {number|null} data.command
		 * @param {number} data.expires
		 * @param {boolean} [data.pending]
		 */
		constructor (data) {
			this.#channel = data.channel ?? null;
			this.#user = data.user ?? null;
			this.#command = data.command ?? null;
			this.#expires = data.expires;
		}

		/**
		 * Checks if a given combination of parameters connects to this instance.
		 * @param {number|null} channel
		 * @param {number|null} user
		 * @param {number|null} command
		 * @returns {boolean} True if cooldown applies and is active, false otherwise.
		 */
		check (channel, user, command) {
			return (
				(this.#channel === null || channel === this.#channel)
				&& (this.#user === null || user === this.#user)
				&& (this.#command === null || command === this.#command)
				&& (Date.now() <= this.#expires)
			);
		}

		/**
		 * Sets the cooldown to not apply anymore by settings its expiry to zero.
		 */
		revoke () {
			this.#expires = 0;
		}

		get channel () { return this.#channel; }
		get user () { return this.#user; }
		get command () { return this.#command; }
		get expires () { return this.#expires; }
	}

	class Pending extends Cooldown {
		constructor (data) {
			data.expires = Infinity;
			super(data);
		}
	}

	/**
	 * Manages the cooldowns between each message sent to channels.
	 * @name sb.CooldownManager
	 * @type CooldownManager()
	 */
	return class CooldownManager extends Module {
		/**
		 * @inheritDoc
		 * @returns {CooldownManager}
		 */
		static singleton() {
			if (!CooldownManager.module) {
				CooldownManager.module = new CooldownManager();
			}
			return CooldownManager.module;
		}

		/**
		 * Creates a new Cooldown manager instance.
		 */
		constructor () {
			super();
			this.data = [];
		}

		/**
		 * Checks if given combination of parameters has a cooldown pending.
		 * @param {number|null} channel
		 * @param {number|null} user
		 * @param {number|null} command
		 * @param {boolean} skipPending If true, does not check for Pending status
		 * @returns {boolean} True if it's safe to run the command, false if the execution should be denied.
		 */
		check (channel, user, command, skipPending) {
			const length = this.data.length;
			for (let i = 0; i < length; i++) {
				const cooldown = this.data[i];
				if ((!skipPending || cooldown.constructor === Cooldown) && cooldown.check(channel, user, command)) {
					return false;
				}
			}

			return true;
		}

		/**
		 * Sets a cooldown for given combination of parameters
		 * @param {number|null} channel
		 * @param {number|null} user
		 * @param {number|null} command
		 * @param {number} cooldown
		 * @param {Object} options={}
		 */
		set (channel, user, command, cooldown, options = {}) {
			this.data.push(new Cooldown({
				channel,
				user,
				command,
				expires: Date.now() + cooldown,
				...options
			}));
		}

		/**
		 * Sets a pending cooldown (it's really a status) for given user.
		 * @param {number} user
		 */
		setPending (user) {
			this.data.push(new Pending({ user }));
		}

		/**
		 * Prematurely revoke a cooldown given by its parameters.
		 * @param {number|null} channel
		 * @param {number|null} user
		 * @param {number|null} command
		 * @param {Object} options = {}
		 */
		unset (channel, user, command, options = {}) {
			const cooldowns = this.data.filter(i => (
				(i instanceof Cooldown)
				&& (i.channel === channel)
				&& (i.user === user)
				&& (i.command === command)
				&& Object.entries(options).every(([key, value]) => i[key] === value)) // checks all options
			);

			for (const cooldown of cooldowns) {
				cooldown.revoke();
			}
		}

		/**
		 * Unsets a pending cooldown for given user.
		 * @param {number} user
		 */
		unsetPending (user) {
			const pendings = this.data.filter(i => (
				(i instanceof Pending)
				&& (user === i.user)
			));

			for (const pending of pendings) {
				pending.revoke();
			}
		}

		/**
		 * Removes expired cooldowns from the list.
		 */
		prune () {
			const now = Date.now();
			const length = this.data.length;
			for (let i = length - 1; i >= 0; i--) {
				if (this.data[i].expires <= now) {
					this.data.splice(i, 1);
				}
			}
		}

		get modulePath () { return "cooldown-manager"; }

		// Exporting the classes, just in case they're needed externally
		static get Cooldown () { return Cooldown; }
		static get Pending () { return Pending; }

		/**
		 * Cleans up.
		 */
		destroy () {
			this.data = null;
		}
	};
});