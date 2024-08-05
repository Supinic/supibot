const MAX_TIMEOUT = (2 ** 31) - 1;

/**
 * Originally hosted in a separate repository (`Supinic/long-timeout`) but moved to Supibot due to no other places using this module.
 * The repository only had a single initial commit (a809345f49a2ba2b65c7c36dc70ba927b3203c10) and that's all.
 */
module.exports = class LongTimeout {
	timeout: NodeJS.Timeout | LongTimeout | number | null;
	scheduleTime: Date;

	/**
	 * Creates a new, flexible, long timeout object
	 * @param {Function} callback Function to fire
	 * @param {number} time Delay or timestamp
	 * @param {boolean} [useTimestamp] If true, time will be considered as a timestamp instead of as a delay
	 * @returns {LongTimeout}
	 */
	constructor(callback: Function, time: number, useTimestamp: boolean = false) {
		if (typeof time !== "number" || !Number.isFinite(time)) {
			throw new Error("A finite number must be used for LongTimeout");
		}

		if (useTimestamp) {
			this.scheduleTime = new Date(time);
			time = time - Date.now();
		}
		else {
			this.scheduleTime = new Date(Date.now() + time);
		}

		if (typeof time !== "number" || time < MAX_TIMEOUT) {
			this.timeout = setTimeout(callback, time);
		}
		else {
			this.timeout = setTimeout(() => {
				this.timeout = null;
				this.timeout = new LongTimeout(callback, (time - MAX_TIMEOUT), useTimestamp);
			}, MAX_TIMEOUT);
		}
	}


	/**
	 * Clears the timeout.
	 */
	clear() {
		// Recursively look inside to get the underlying timeout type in case this happens to be nested
		let timeoutToClear = this.timeout;
		while (timeoutToClear instanceof LongTimeout) {
			timeoutToClear = timeoutToClear.timeout;
		}

		if (timeoutToClear) {
			clearTimeout(timeoutToClear);
		}

		this.timeout = null;
	}
};
