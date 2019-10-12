/**
 * Represents an extended Timeout object.
 * @type {module.LongTimeout}
 */
module.exports = class LongTimeout {
	/**
	 * Creates a new, flexible, long timeout object
	 * @param {Function} callback Function to fire
	 * @param {number} time Delay or timestamp
	 * @param {boolean} [useTimestamp] If true, time will be considered as a timestamp instead of as a delay
	 * @returns {LongTimeout}
	 */
	constructor (callback, time, useTimestamp = false) {
		const maxTimeout = Math.pow(2, 31) - 1;

		if (typeof time !== "number" || !Number.isFinite(time)) {
			throw new Error("A finite number must be used for LongTimeout, got " + time + " instead");
		}

		if (useTimestamp) {
			this.scheduleTime = new Date(time);
			time = time - Date.now();
		}
		else {
			this.scheduleTime = new Date(Date.now() + time);
		}

		this.timeout = (typeof time !== "number" || time < maxTimeout)
			? setTimeout(callback, time)
			: setTimeout(() => {
				this.timeout = null;
				this.timeout = new LongTimeout(callback, (time - maxTimeout), useTimestamp);
			}, maxTimeout);
	}

	/**
	 * Clears the timeout.
	 */
	clear () {
		clearTimeout(this.timeout);
		this.timeout = null;
	}
};