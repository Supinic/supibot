import { SupiError } from "supi-core";

const MAX_TIMEOUT = 2147483647;

/**
 * Originally hosted in a separate repository (`Supinic/long-timeout`) but moved to Supibot due to no other places using this module.
 * The repository only had a single initial commit (a809345f49a2ba2b65c7c36dc70ba927b3203c10) and that's all.
 */
export default class LongTimeout {
	timeout: NodeJS.Timeout | LongTimeout | number | null;
	readonly scheduleTime: Date;

	/**
	 * Creates a new, flexible, long timeout object
	 * @param callback Function to fire
	 * @param time Delay or timestamp
	 * @param [useTimestamp] If true, time will be considered as a timestamp instead of as a delay
	 */
	constructor (callback: () => unknown, time: number, useTimestamp: boolean = false) {
		if (!Number.isFinite(time)) {
			throw new SupiError({
				message: "A finite number must be used for LongTimeout"
			});
		}

		if (useTimestamp) {
			this.scheduleTime = new Date(time);
			time = time - Date.now();
		}
		else {
			this.scheduleTime = new Date(Date.now() + time);
		}

		if (time < MAX_TIMEOUT) {
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
	clear () {
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
